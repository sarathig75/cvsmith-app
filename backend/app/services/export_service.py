"""The saved canvas (CV.content) as a JSON Resume document, and the download file name.

The canvas shape is the frontend's CvDraft (frontend/src/types/cvDraft.ts); this is the
inverse of frontend/src/utils/resumeToDraft.ts.
"""
import re
from typing import Any, Dict, List, Optional

from app.models.cv import CV
from app.models.user import utcnow
from app.schemas.common import as_utc

BULLET = re.compile(r"^\s*[•\-*]\s*")


def _s(v: Any) -> str:
    return v.strip() if isinstance(v, str) else ""


def _list(v: Any) -> List[Dict[str, Any]]:
    return [e for e in v if isinstance(e, dict)] if isinstance(v, list) else []


def _split(text: str) -> Dict[str, Any]:
    """Canvas text: lines starting with a bullet are highlights, the rest the summary."""
    summary, highlights = [], []
    for line in (text or "").splitlines():
        if not line.strip():
            continue
        (highlights if BULLET.match(line) else summary).append(BULLET.sub("", line).strip())
    return {"summary": "\n".join(summary), "highlights": highlights}


def _clean(d: Dict[str, Any]) -> Dict[str, Any]:
    """Drop empty values so the export only holds what the user filled in."""
    return {k: v for k, v in d.items() if v not in ("", None, [], {})}


def _dates(e: Dict[str, Any], current: bool = False) -> Dict[str, str]:
    return {"startDate": _s(e.get("start")), "endDate": "" if current else _s(e.get("end"))}


def to_json_resume(content: Optional[Dict[str, Any]], cv: CV) -> Dict[str, Any]:
    c = content or {}
    p = c.get("personal") if isinstance(c.get("personal"), dict) else {}
    basics = _clean({
        "name": _s(p.get("name")),
        "label": _s(p.get("headline")),
        "email": _s(p.get("email")),
        "phone": _s(p.get("phone")),
        "url": _s(p.get("portfolio")),
        "summary": _s(c.get("summary")),
        "location": _clean({"address": _s(p.get("location"))}),
        "profiles": [{"network": "LinkedIn", "url": _s(p.get("linkedin"))}] if _s(p.get("linkedin")) else [],
    })
    work = []
    for e in _list(c.get("experience")):
        current = e.get("current") == "true"
        work.append(_clean({"name": _s(e.get("company")), "position": _s(e.get("title")),
                            **_dates(e, current), **_split(e.get("description", ""))}))
    projects = []
    for e in _list(c.get("projects")):
        text = _split(e.get("description", ""))
        projects.append(_clean({"name": _s(e.get("name")), "url": _s(e.get("url")), **_dates(e),
                                "description": text["summary"], "highlights": text["highlights"]}))
    education = [
        _clean({"institution": _s(e.get("school")), "studyType": _s(e.get("degree")),
                "score": _s(e.get("score")), **_dates(e)})
        for e in _list(c.get("education"))
    ]
    skills = [s.strip() for s in c.get("skills", []) if isinstance(s, str) and s.strip()]
    certificates = [
        _clean({"name": _s(e.get("name")), "issuer": _s(e.get("issuer")), "date": _s(e.get("date"))})
        for e in _list(c.get("certifications"))
    ]
    out: Dict[str, List[Dict[str, Any]]] = {"languages": [], "awards": [], "volunteer": [], "interests": []}
    custom = []
    for e in _list(c.get("others")):
        kind, title, detail = e.get("kind"), _s(e.get("title")), _s(e.get("detail"))
        if kind == "language":
            out["languages"].append(_clean({"language": title, "fluency": detail}))
        elif kind == "award":
            out["awards"].append(_clean({"title": title, "awarder": detail, "date": _s(e.get("start")),
                                         "summary": _s(e.get("description"))}))
        elif kind == "volunteer":
            out["volunteer"].append(_clean({"position": title, "organization": detail, **_dates(e),
                                            **_split(e.get("description", ""))}))
        elif kind == "interest":
            out["interests"].append(_clean({"name": title,
                                            "keywords": [k.strip() for k in detail.split(",") if k.strip()]}))
        else:
            custom.append(_clean({"section": _s(e.get("section")) or "Other", "title": title, "detail": detail,
                                  **_dates(e), "description": _s(e.get("description"))}))
    resume = _clean({
        "basics": basics,
        "work": [w for w in work if w],
        "projects": [x for x in projects if x],
        "education": [x for x in education if x],
        "skills": [{"name": s} for s in skills],
        "certificates": [x for x in certificates if x],
        **{k: [x for x in v if x] for k, v in out.items()},
    })
    resume["$schema"] = "https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json"
    resume["meta"] = {
        "version": "v1.0.0",
        "lastModified": as_utc(cv.content_updated_at or cv.created_at or utcnow()).isoformat(),
        # CVSmith extension: the privacy setting and items with no JSON Resume equivalent.
        "cvsmith": _clean({"privacy": cv.privacy, "customSections": [x for x in custom if x]}),
    }
    return resume


def download_name(content: Optional[Dict[str, Any]], ext: str) -> str:
    """'Jane Doe CV.pdf'; letters, digits, spaces and a few safe marks only."""
    p = (content or {}).get("personal")
    name = _s(p.get("name")) if isinstance(p, dict) else ""
    safe = re.sub(r"[^\w .'-]", "", name, flags=re.UNICODE).strip(" .")[:80]
    return f"{safe} CV.{ext}" if safe else f"CV.{ext}"
