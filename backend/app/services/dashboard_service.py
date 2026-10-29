"""CV strength (how complete the CV is) and the dashboard state. Contract: docs/API_CONTRACT.md."""
from typing import Any, Dict, List, Optional

from app.models.cv import CV
from app.services.ats import facts as facts_mod
from app.services.ats.facts import Facts, parse_date

SECTIONS = ("contact", "summary", "experience", "education", "skills", "projects", "others")
LABELS = {"contact": "Contact and headline", "summary": "Professional summary", "experience": "Work experience",
          "education": "Education", "skills": "Skills", "projects": "Projects",
          "others": "Certifications and others"}
MAX_POINTS = {"contact": 15, "summary": 10, "experience": 30, "education": 10, "skills": 15,
              "projects": 10, "others": 10}
ADVICE = {
    "contact": "Add your name, email and a headline",
    "summary": "Write a short professional summary",
    "experience": "Add a role with its title, employer and dates",
    "education": "Add your education",
    "skills": "Add at least 5 skills",
    "projects": "Add a project",
    "others": "Add a certification, language or award",
}


def _role_complete(r) -> bool:
    return bool(r.title and r.company and parse_date(r.start) and (r.current or parse_date(r.end)))


def _points(f: Facts) -> Dict[str, int]:
    contact = 5 * sum(1 for v in (f.name, f.email, f.headline) if v)
    roles_done = any(_role_complete(r) for r in f.roles)
    return {
        "contact": contact,
        "summary": 10 if f.summary else 0,
        "experience": 30 if roles_done else 10 if f.roles else 0,
        "education": 10 if f.education_count else 0,
        "skills": round(15 * min(len(f.skills), 5) / 5),
        "projects": 10 if f.project_count else 0,
        "others": 10 if (f.certification_count or f.other_count) else 0,
    }


def cv_strength(content: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    points = _points(facts_mod.from_content(content))
    percent = sum(points.values())
    sections: List[Dict[str, Any]] = [
        {"key": k, "label": LABELS[k], "points": points[k], "max": MAX_POINTS[k],
         "complete": points[k] >= MAX_POINTS[k]}
        for k in SECTIONS
    ]
    gaps = [(MAX_POINTS[k] - points[k], i, k) for i, k in enumerate(SECTIONS) if points[k] < MAX_POINTS[k]]
    next_step = None
    if gaps:
        gain, _, key = sorted(gaps, key=lambda g: (-g[0], g[1]))[0]
        next_step = {"section": key, "points": gain,
                     "text": f"{ADVICE[key]} to reach {min(percent + gain, 100)}%."}
    return {"percent": percent, "sections": sections, "next_step": next_step}


def state_of(cv: Optional[CV]) -> str:
    if cv is None:
        return "no_cv"
    if cv.content:
        return "ready"
    if cv.parsing_status in ("pending", "in_progress"):
        return "parsing"
    if cv.parsing_status == "failed":
        return "needs_details"
    return "ready"
