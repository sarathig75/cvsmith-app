"""Job alignment: requirements from a job spec, the Mode B score, a proposed headline, gaps and ideas.

Contract: docs/API_CONTRACT.md, "Job alignment". The saved CV is never changed here except by apply().
"""
import copy
import json
import logging
import re
import uuid
from datetime import date
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.alignment import AlignmentRun
from app.models.cv import CV
from app.models.user import User, utcnow
from app.services import cv_service, event_service, learning_service, suggestion_service
from app.services.alignment_ai import AlignmentAI, AlignmentAIError
from app.services.ats import facts as facts_mod
from app.services.ats import service as ats_service
from app.services.ats import text as tx
from app.services.ats.score import Requirements, ScoreResult, score_mode_b
from app.services.pdf_service import PdfRenderer
from app.services.suggestion_guard import unlisted_capitalised
from app.utils import errors

logger = logging.getLogger("cvsmith.alignment")

MIN_SPEC_CHARS = 80
MAX_SPEC_CHARS = 20000


def _requirements_out(req: Requirements) -> Dict[str, Any]:
    return {**req.as_dict(), "sector": req.sector or None}


def _requirements_in(data: Dict[str, Any]) -> Requirements:
    return Requirements(
        job_title=data.get("job_title", ""), core_skills=list(data.get("core_skills", [])),
        secondary_skills=list(data.get("secondary_skills", [])), years_required=data.get("years_required"),
        needs_management=bool(data.get("needs_management")), sector=data.get("sector") or "",
    )


def _gaps(result: ScoreResult, req: Requirements, headline: Optional[str]) -> List[Dict[str, Any]]:
    gaps = []
    for importance, skills, hit in (("core", req.core_skills, result.detail.get("core_hit", [])),
                                    ("secondary", req.secondary_skills, result.detail.get("second_hit", []))):
        for skill in skills:
            covered = skill in hit
            by_headline = (not covered) and bool(headline) and tx.skill_in(headline.lower(), skill)
            gaps.append({"skill": skill, "importance": importance,
                         "status": "covered" if covered else "missing", "by_headline": by_headline})
    return gaps


def apply_selection(content: Dict[str, Any], result: Dict[str, Any], use_headline: bool,
                    skills: List[str], use_summary: bool = False) -> Dict[str, Any]:
    """A copy of the saved canvas with the ticked changes: the proposed headline and summary, and skills added
    when the CV does not list them already. Raises a validation error for a skill that is not a missing gap, or
    for a headline or summary that was not proposed."""
    missing = {g["skill"].lower(): g["skill"] for g in result["gaps"] if g["status"] == "missing"}
    for skill in skills:
        if skill.lower() not in missing:
            raise errors.validation_error("That skill is not a gap of this alignment.")
    changed = copy.deepcopy(content)
    positioning = result.get("positioning")
    if use_headline:
        if not positioning:
            raise errors.validation_error("This alignment has no proposed headline.")
        personal = changed.get("personal") if isinstance(changed.get("personal"), dict) else {}
        personal["headline"] = positioning["proposed"]
        changed["personal"] = personal
    if use_summary:
        proposed_summary = result.get("summary")
        if not proposed_summary:
            raise errors.validation_error("This alignment has no proposed summary.")
        changed["summary"] = proposed_summary["proposed"]
    have = [s for s in changed.get("skills", []) if isinstance(s, str)]
    lower = {s.lower() for s in have}
    for skill in skills:
        name = missing[skill.lower()]
        if name.lower() not in lower:
            have.append(name)
            lower.add(name.lower())
    if skills:
        changed["skills"] = have
    return changed


def _score(db: Session, cv: CV, renderer: PdfRenderer, content: Dict[str, Any], req: Requirements) -> ScoreResult:
    layout = ats_service.after_layout(db, cv, renderer)
    return score_mode_b(facts_mod.from_content(content), layout, req, date.today())


SUMMARY_GROWTH = 1.5
SUMMARY_GROWTH_SLACK = 60
# A summary of 2 to 4 sentences: a short current summary may grow up to this many characters.
SUMMARY_MAX_CHARS = 500


def _numbers(text: str) -> set:
    return set(re.findall(r"\d[\d,.]*", text))


def _summary_proposal(current: str, proposed: str, content: Dict[str, Any],
                      base: ScoreResult) -> Optional[Dict[str, str]]:
    """The proposed summary, or None when it must not be shown: unchanged, or it could add a claim the CV does not
    support (a name, a number or a skill listed as missing), or it is much longer than the current one (more than
    1.5 times, and over 500 characters)."""
    proposed = proposed.strip()
    if not proposed or " ".join(proposed.lower().split()) == " ".join(current.lower().split()):
        return None
    if unlisted_capitalised(proposed, current, content):
        return None
    corpus = current + " " + json.dumps(content, ensure_ascii=False)
    if _numbers(proposed) - _numbers(corpus):
        return None
    missing = base.detail.get("core_missing", []) + base.detail.get("second_missing", [])
    if any(tx.skill_in(proposed.lower(), skill) for skill in missing):
        return None
    if len(proposed) > max(SUMMARY_GROWTH * len(current) + SUMMARY_GROWTH_SLACK, SUMMARY_MAX_CHARS):
        return None
    return {"current": current, "proposed": proposed}


def run(
    db: Session, user: User, cv: Optional[CV], ai: AlignmentAI, renderer: PdfRenderer, job_spec: str
) -> AlignmentRun:
    if user.plan != "pro":
        event_service.record(db, user.id, "upgrade_prompt_shown", {"feature": "alignment"})
        raise errors.alignment_pro_required()
    spec = job_spec.strip()
    if len(spec) < MIN_SPEC_CHARS:
        raise errors.validation_error("Paste the full job description (at least a few sentences).")
    if len(spec) > MAX_SPEC_CHARS:
        raise errors.validation_error(f"This job description is too long (over {MAX_SPEC_CHARS} characters).")
    if cv is None or not cv.content:
        raise errors.not_found("Open your CV on the Canvas first, so it is saved. Then align it to a job.")
    if suggestion_service.quota(db, user)["remaining"] <= 0:
        raise errors.alignment_quota_exceeded()
    try:
        req = ai.read_spec(spec)
        content = cv.content
        base = _score(db, cv, renderer, content, req)
        missing = [s for s in (*req.core_skills, *req.secondary_skills) if s in
                   (base.detail.get("core_missing", []) + base.detail.get("second_missing", []))]
        personal = content.get("personal") if isinstance(content.get("personal"), dict) else {}
        current = str(personal.get("headline") or "")
        facts = suggestion_service.cv_facts(content, include_summary=True, include_descriptions=True)
        current_summary = str(content.get("summary") or "")
        proposed, proposed_summary, consider = ai.write_positioning(req, facts, current, current_summary, missing)
    except AlignmentAIError:
        raise errors.alignment_failed()
    # A headline that names something the CV does not contain is dropped, never shown (same guard as suggestions).
    positioning = None
    if proposed and " ".join(proposed.lower().split()) != " ".join(current.lower().split()) \
            and not unlisted_capitalised(proposed, current, content):
        positioning = {"current": current, "proposed": proposed}
    summary = _summary_proposal(current_summary, proposed_summary, content, base)
    result = {
        "requirements": _requirements_out(req),
        "positioning": positioning,
        "summary": summary,
        "gaps": _gaps(base, req, positioning["proposed"] if positioning else None),
        "consider": consider,
        "score": base.public(),
    }
    row = AlignmentRun(user_id=user.id, cv_id=cv.id, requirements=_requirements_out(req), result=result)
    db.add(row)
    db.commit()
    for kind, term in base.unmatched:  # for the weekly review of the lists (no user link, no CV text)
        learning_service.record_unmatched(db, kind, term)
    event_service.record(db, user.id, "alignment_run")
    return row


def get(db: Session, user: User, run_id: uuid.UUID) -> AlignmentRun:
    row = db.get(AlignmentRun, run_id)
    if row is None or row.user_id != user.id:
        raise errors.not_found("Alignment not found.")
    return row


def present(row: AlignmentRun) -> Dict[str, Any]:
    return {"id": row.id, "created_at": row.created_at, **row.result}


def _current_cv(db: Session, user: User, row: AlignmentRun) -> CV:
    cv = cv_service.get_cv(db, user)
    if cv is None or not cv.content:
        raise errors.not_found("Your CV is no longer saved. Open the Canvas first.")
    return cv


def preview(db: Session, user: User, renderer: PdfRenderer, row: AlignmentRun, use_headline: bool,
            skills: List[str], use_summary: bool = False) -> Dict[str, Any]:
    """Mode B score of the saved CV with the ticked changes. Recomputed by the rules: no AI, nothing stored."""
    cv = _current_cv(db, user, row)
    changed = apply_selection(cv.content, row.result, use_headline, skills, use_summary)
    return _score(db, cv, renderer, changed, _requirements_in(row.requirements)).public()


def apply(db: Session, user: User, row: AlignmentRun, use_headline: bool, skills: List[str],
          use_summary: bool = False) -> CV:
    """Update the saved CV with the ticked changes."""
    cv = _current_cv(db, user, row)
    cv.content = apply_selection(cv.content, row.result, use_headline, skills, use_summary)
    cv.content_updated_at = utcnow()
    db.commit()
    return cv


def job_version(db: Session, user: User, row: AlignmentRun, use_headline: bool, skills: List[str],
                use_summary: bool = False) -> Dict[str, Any]:
    """The canvas for a job-only PDF: the saved CV with the ticked changes. Nothing is stored."""
    cv = _current_cv(db, user, row)
    return apply_selection(cv.content, row.result, use_headline, skills, use_summary)


def job_file_name(content: Dict[str, Any], job_title: str) -> str:
    """'Jane Doe CV - HR Business Partner.pdf' (letters, digits, spaces and a few safe marks only)."""
    personal = content.get("personal") if isinstance(content.get("personal"), dict) else {}
    name = re.sub(r"[^\w .'-]", "", str(personal.get("name") or ""), flags=re.UNICODE).strip(" .")[:60]
    job = re.sub(r"[^\w .'-]", "", job_title or "", flags=re.UNICODE).strip(" .")[:60]
    base = f"{name} CV" if name else "CV"
    return f"{base} - {job}.pdf" if job else f"{base}.pdf"
