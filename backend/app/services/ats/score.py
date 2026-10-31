"""ATS score: Mode A (CV only) and Mode B (with a job spec). Rules: docs/ATS_FRAMEWORK.md.

Pure functions, no database and no AI: the same CV and the same requirements always give the same
score. A check that does not apply is left out and the score is earned / applicable * 100
("not applicable is removed, not zero"). Terms the lists did not recognise are returned in
`ScoreResult.unmatched` for the caller to record (docs/ATS_RULES.md, sections 6-7).
"""
import re
from collections import Counter
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Dict, List, Optional, Tuple

from app.services.ats import text as tx
from app.services.ats.facts import Facts, Role, parse_date
from app.services.ats.lists import LADDERS, RELATED_FAMILIES, SECTOR_TERMS

FRAMEWORK = "ats-framework-v2"

MODE_A: Dict[str, int] = {"A1": 12, "A2": 12, "A3": 11, "A4": 8, "A5": 9, "A6": 10, "A7": 10,
                          "A8": 7, "A9": 5, "A10": 4, "A11": 6, "A12": 6}
MODE_B_CV: Dict[str, int] = {"A1": 8, "A2": 7, "A3": 6, "A4": 5, "A5": 5, "A6": 6, "A7": 6,
                             "A8": 4, "A9": 3, "A10": 2, "A11": 4, "A12": 4}
MODE_B_JOB: Dict[str, int] = {"B1": 14, "B2": 6, "B3": 4, "B4": 6, "B5": 6, "B6": 2, "B7": 2}

LABELS = {
    "A1": "Text can be read in order", "A2": "Standard section headings", "A3": "Contact details complete",
    "A4": "No tables, text boxes, icons or header-only contact details (estimated)", "A5": "Consistent dates",
    "A6": "Bullets start with a strong verb", "A7": "Achievements have numbers",
    "A8": "No filler or passive phrases", "A9": "Bullets are 15 to 30 words",
    "A10": "Opening verbs are varied", "A11": "Length fits your experience",
    "A12": "Job title and employer on every role",
    "B1": "Must-have skills", "B2": "Other skills asked for", "B3": "Skills used recently",
    "B4": "Years of experience", "B5": "Job title similarity", "B6": "Management scope",
    "B7": "Sector terms",
}
# One check's outcome: the share of its points earned (None = does not apply) and the fix to show.
Result = Tuple[Optional[float], Optional[str]]
ORDER = list(MODE_A) + list(MODE_B_JOB)


@dataclass
class Requirements:
    """What the AI step reads from a job spec (the only AI use in scoring)."""
    job_title: str = ""
    core_skills: List[str] = field(default_factory=list)
    secondary_skills: List[str] = field(default_factory=list)
    years_required: Optional[int] = None
    needs_management: bool = False
    sector: str = ""  # a key of SECTOR_TERMS, or "" when the sector has no list

    def as_dict(self) -> Dict[str, Any]:
        return {"job_title": self.job_title, "core_skills": self.core_skills,
                "secondary_skills": self.secondary_skills, "years_required": self.years_required,
                "needs_management": self.needs_management, "sector": self.sector}


@dataclass
class ScoreResult:
    score: int
    checks: List[Dict[str, Any]]
    first_fix: Optional[Dict[str, Any]]
    mode: str
    unmatched: List[Tuple[str, str]] = field(default_factory=list)
    detail: Dict[str, Any] = field(default_factory=dict)  # e.g. skills matched, for gaps

    def public(self) -> Dict[str, Any]:
        return {"score": self.score, "checks": self.checks, "first_fix": self.first_fix,
                "framework": FRAMEWORK}


def _pct(part: int, whole: int) -> float:
    return part / whole if whole else 0.0


# --- Mode A checks -----------------------------------------------------------------------------
# Each returns (earned fraction 0..1 or None when not applicable, fix text).

def _a1(f: Facts, layout, today):
    if not layout:
        return None, None
    fix = ("Use a text-based PDF or Word file; some text could not be read in order."
           if layout["text"] == "scrambled" else
           "Your file has no readable text layer (it may be a scan). Upload a text-based PDF or Word file.")
    return {"ok": 1.0, "scrambled": 0.5}.get(layout["text"], 0.0), fix


def _a2(f: Facts, layout, today):
    if not layout:
        return None, None
    n = layout["headings"]
    return (1.0 if n == 3 else 0.5 if n else 0.0), \
        "Use the standard headings Experience, Education and Skills (add the missing section)."


def _a3(f: Facts, layout, today):
    parts = [("name", f.name, 2), ("email", f.email, 3), ("phone", f.phone, 2), ("location", f.location, 2),
             ("a LinkedIn or portfolio link", f.links, 2)]
    earned = sum(w for _, v, w in parts if v)
    missing = [n for n, v, _ in parts if not v]
    return earned / 11, ("Add your " + ", ".join(missing) + ".") if missing else None


def _a4(f: Facts, layout, today):
    if not layout:
        return None, None
    lost = 2 * layout["tables"] + 2 * layout["textboxes"] + layout["icons"] + (2 if layout.get("header_contact") else 0)
    fix = ("Move your email and phone out of the Word header or footer into the page: ATS tools often skip headers."
           if layout.get("header_contact") and lost <= 2 else
           "Remove tables, text boxes and icons used in place of text, and keep contact details out of the header; "
           "ATS tools often skip them.")
    return max(8 - lost, 0) / 8, fix


def _a5(f: Facts, layout, today):
    dates = []
    for r in f.roles:
        dates.append(r.start)
        if not r.current:
            dates.append(r.end)
    for s, e in f.education:
        dates.extend([s, e])
    fix = "Give every job a start and end date in one format (month and year)."
    if not f.roles or any(not r.start for r in f.roles):
        return 0.0, fix
    parsed = [parse_date(d) for d in dates if d]
    if any(p is None for p in parsed):
        return 0.0, fix
    for r in f.roles:
        s, e = parse_date(r.start), parse_date(r.end) if r.end and not r.current else None
        if s and e and (e[0], e[1]) < (s[0], s[1]):
            return 0.0, "A job ends before it starts; correct the dates."
    if len({p[2] for p in parsed}) > 1:
        return 4 / 9, "Use one date format throughout (all month and year, or all year only)."
    return 1.0, None


def _a6(f: Facts, layout, today):
    bullets = f.bullets
    if not bullets:
        return 0.0, "Add bullets to your job descriptions, each starting with an action verb."
    strong = sum(1 for b in bullets if tx.is_strong_verb(tx.first_word(b)))
    share = _pct(strong, len(bullets))
    return (1.0 if share >= 0.8 else 5 / 11 if share >= 0.5 else 0.0), \
        "Start more bullets with an action verb such as 'Led', 'Built' or 'Reduced'."


def _a7(f: Facts, layout, today):
    bullets = f.bullets
    if not bullets:
        return 0.0, "Add bullets with numbers, such as results, sizes or percentages."
    share = _pct(sum(1 for b in bullets if tx.has_metric(b)), len(bullets))
    return (1.0 if share >= 0.4 else 5 / 11 if share >= 0.2 else 0.0), \
        "Add numbers (results, team size, percentages) to more bullets."


def _a8(f: Facts, layout, today):
    bullets = f.bullets
    if not bullets:
        return 0.0, "Add bullets to your job descriptions."
    n = sum(tx.filler_count(b) for b in bullets)
    return (1.0 if n == 0 else 3 / 7 if n <= 3 else 0.0), \
        "Replace phrases like 'responsible for' and 'worked on' with what you did and achieved."


def _a9(f: Facts, layout, today):
    bullets = f.bullets
    if not bullets:
        return 0.0, "Add bullets of 15 to 30 words."
    share = _pct(sum(1 for b in bullets if 15 <= tx.word_count(b) <= 30), len(bullets))
    return (1.0 if share >= 0.8 else 2 / 5 if share >= 0.5 else 0.0), \
        "Aim for bullets of 15 to 30 words: not too short, not a paragraph."


def _a10(f: Facts, layout, today):
    words = [tx.first_word(b) for b in f.bullets]
    if not words:
        return 0.0, "Add bullets to your job descriptions."
    top = Counter(w for w in words if w).most_common(1)
    return (0.0 if top and top[0][1] > 4 else 1.0), \
        "Vary how bullets begin: one verb opens more than four of them."


def _a11(f: Facts, layout, today):
    if not layout or not layout.get("pages"):
        return None, None
    years, pages = f.years_of_experience(today), layout["pages"]
    ideal = 1 if years < 5 else 2 if years <= 15 else 3  # the most pages that fit this experience
    if pages <= ideal:
        return 1.0, None
    return (0.5 if pages == ideal + 1 else 0.0), \
        f"Your CV is {pages} pages; for your experience aim for {ideal} page{'s' if ideal > 1 else ''} or fewer."


def _a12(f: Facts, layout, today):
    if not f.roles:
        return 0.0, "Add your jobs, each with a job title and an employer."
    done = sum(1 for r in f.roles if r.title and r.company)
    share = done / len(f.roles)
    return (1.0 if share == 1 else 0.5 if share >= 0.5 else 0.0), "Give every job a job title and an employer."


CHECKS = {"A1": _a1, "A2": _a2, "A3": _a3, "A4": _a4, "A5": _a5, "A6": _a6, "A7": _a7, "A8": _a8,
          "A9": _a9, "A10": _a10, "A11": _a11, "A12": _a12}


# --- Mode B checks -----------------------------------------------------------------------------

def _recent_roles(f: Facts, today: date) -> Tuple[List[Role], List[Role]]:
    """(the most recent role as a list, other roles that ended within 3 years), (older roles come next)."""
    roles = f.sorted_roles(today)
    if not roles:
        return [], []
    latest, rest = roles[:1], roles[1:]
    cutoff = today.year * 12 + today.month - 36
    recent = []
    for r in rest:
        e = parse_date(r.end)
        if r.current or not r.end or (e and e[0] * 12 + e[1] >= cutoff):
            recent.append(r)
    return latest, recent


def _match_title(title: str) -> Optional[Tuple[str, int]]:
    """(family, rung index) of a job title on a ladder, or None."""
    t = tx.normalise_title(title)
    if not t:
        return None
    best: Optional[Tuple[str, int, int]] = None
    for family, rungs in LADDERS.items():
        for i, rung in enumerate(rungs):
            for alt in rung.split("/"):
                if t == alt or (t.endswith(alt) and len(alt) >= 8 and best is None):
                    score = 2 if t == alt else 1
                    if best is None or score > best[2]:
                        best = (family, i, score)
    return (best[0], best[1]) if best else None


def _b5(f: Facts, req: Requirements, today: date, unmatched):
    job = _match_title(req.job_title)
    if job is None:
        unmatched.append(("title", req.job_title))
        return None, None
    titles = [r.title for r in f.sorted_roles(today)[:2] if r.title]
    cv = [(t, _match_title(t)) for t in titles]
    found = [m for _, m in cv if m]
    if not found:
        for t in titles:
            unmatched.append(("title", t))
        return None, None
    best = 0.0
    for family, rung in found:
        if family == job[0] and rung in (job[1], job[1] - 1):
            best = max(best, 1.0)
        elif family == job[0] or frozenset((family, job[0])) in RELATED_FAMILIES:
            best = max(best, 0.5)
    return best, "Your recent job titles are far from this role's title; say so in your headline if the work matches."


def _b6(f: Facts, req: Requirements, today: date, unmatched):
    if not req.needs_management:
        return None, None
    text = "\n".join([f.summary, *(r.description for r in f.roles)]).lower()
    sized = re.search(r"team of \d+|\b\d+\+?\s*(direct reports|reports|people|members|engineers|staff|employees)\b"
                      r"|budget|p&l|[$£€₹]\s?\d", text)
    lead = re.search(r"\b(led|managed|supervised|mentored|head of|lead)\b", text)
    return (1.0 if sized else 0.5 if lead else 0.0), \
        "The job asks for management: state your team size or budget in a bullet."


JobMatch = Tuple[Dict[str, Result], List[Tuple[str, str]], Dict[str, Any]]


def score_job_match(f: Facts, req: Requirements, today: date) -> JobMatch:
    """Fractions (0..1) for B1-B7, the unmatched terms, and the skill detail the gaps list uses."""
    out: Dict[str, Result] = {}
    unmatched: List[Tuple[str, str]] = []
    text = f.text()
    core = [s for s in req.core_skills if s.strip()]
    second = [s for s in req.secondary_skills if s.strip()]
    core_hit = [s for s in core if tx.skill_in(text, s)]
    second_hit = [s for s in second if tx.skill_in(text, s)]
    for s in core + second:
        if not tx.skill_is_known(s):
            unmatched.append(("skill", s))
    out["B1"] = (_pct(len(core_hit), len(core)), "Add the must-have skills you really have, where you used them.") \
        if core else (None, None)
    out["B2"] = (_pct(len(second_hit), len(second)), "Add the other skills the job asks for, if you have them.") \
        if second else (None, None)

    if core_hit:
        latest, recent = _recent_roles(f, today)

        def in_roles(roles: List[Role], skill: str) -> bool:
            return any(tx.skill_in(" ".join([r.title, r.description]).lower(), skill) for r in roles)

        if any(in_roles(latest, s) or in_roles(recent, s) for s in core_hit):
            frac = 1.0
        elif any(tx.skill_in(" ".join([r.title, r.description]).lower(), s) for r in f.roles for s in core_hit):
            frac = 0.5
        else:
            frac = 0.25
    else:
        frac = 0.0
    out["B3"] = (frac, "Show your must-have skills in your latest role, not only in the skills list.") \
        if core else (None, None)

    if req.years_required:
        have, need = f.years_of_experience(today), req.years_required
        out["B4"] = (1.0 if have >= need else 0.5 if need - have <= 2 else 0.0,
                     f"The job asks for {need} years; your CV shows about {int(have)}.")
    else:
        out["B4"] = (None, None)
        unmatched.append(("requirement", "years"))  # recorded when the spec asks for none (docs/ATS_RULES.md, 6)
    out["B5"] = _b5(f, req, today, unmatched)
    out["B6"] = _b6(f, req, today, unmatched)
    if not req.needs_management:
        unmatched.append(("requirement", "management"))
    terms = SECTOR_TERMS.get(req.sector)
    if terms:
        share = _pct(sum(1 for t in terms if tx.contains_term(text, t)), len(terms))
        out["B7"] = (1.0 if share >= 0.5 else 0.5 if share >= 0.25 else 0.0,
                     f"Use more of the {req.sector.lower()} terms the job relies on, where they are true.")
    else:
        out["B7"] = (None, None)
        if req.sector:
            unmatched.append(("sector", req.sector))
    detail = {"core_hit": core_hit, "core_missing": [s for s in core if s not in core_hit],
              "second_hit": second_hit, "second_missing": [s for s in second if s not in second_hit]}
    return out, unmatched, detail


# --- Scoring -----------------------------------------------------------------------------------

def _assemble(results: Dict[str, Result], maxima: Dict[str, int], mode: str) -> ScoreResult:
    applicable = {cid: m for cid, m in maxima.items() if results[cid][0] is not None}
    total = sum(applicable.values())
    checks = []
    for cid in [c for c in ORDER if c in maxima]:
        frac, fix = results[cid]
        if frac is None:
            continue  # left out: not shown, not scored
        earned = round(frac * maxima[cid], 1)
        checks.append({"id": cid, "label": LABELS[cid], "passed": frac >= 1.0, "points": earned,
                       "max": maxima[cid], "fix": None if frac >= 1.0 else fix})
    score = round(sum(c["points"] for c in checks) / total * 100) if total else 0
    first_fix = None
    lost = [(c["max"] - c["points"], i, c) for i, c in enumerate(checks) if c["fix"]]
    if lost:
        gap, _, c = sorted(lost, key=lambda x: (-x[0], x[1]))[0]
        first_fix = {"check_id": c["id"], "text": c["fix"], "points": round(gap / total * 100)}
    return ScoreResult(score=score, checks=checks, first_fix=first_fix, mode=mode)


def _record_verbs(f: Facts, unmatched: List[Tuple[str, str]]) -> None:
    for b in f.bullets:
        w = tx.first_word(b)
        if tx.looks_like_unlisted_verb(w):
            unmatched.append(("verb", w))


def score_mode_a(f: Facts, layout: Optional[Dict[str, Any]], today: Optional[date] = None) -> ScoreResult:
    today = today or date.today()
    results = {cid: fn(f, layout, today) for cid, fn in CHECKS.items()}
    out = _assemble(results, MODE_A, "A")
    _record_verbs(f, out.unmatched)
    return out


def score_mode_b(f: Facts, layout: Optional[Dict[str, Any]], req: Requirements,
                 today: Optional[date] = None) -> ScoreResult:
    """60 points from checks A1-A11 (scaled down) plus 40 from the job-match checks. Not applicable
    checks are left out and the rest is scaled to 100."""
    today = today or date.today()
    results: Dict[str, Result] = {cid: fn(f, layout, today) for cid, fn in CHECKS.items()}
    job, unmatched, detail = score_job_match(f, req, today)
    results.update(job)
    out = _assemble(results, {**MODE_B_CV, **MODE_B_JOB}, "B")
    out.unmatched = unmatched
    out.detail = detail
    _record_verbs(f, out.unmatched)
    return out
