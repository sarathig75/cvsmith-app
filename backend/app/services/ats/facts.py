"""What the ATS checks read from a CV: one plain structure built from the canvas (CV.content) or,
for the "before" score, from the parser output (JSON Resume)."""
import re
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Dict, List, Optional, Tuple

BULLET = re.compile(r"^\s*[•\-*·▪–]\s*")
DATE_RE = re.compile(r"^(\d{4})(?:-(\d{2}))?")


def _s(v: Any) -> str:
    return v.strip() if isinstance(v, str) else ""


def _list(v: Any) -> List[Dict[str, Any]]:
    return [e for e in v if isinstance(e, dict)] if isinstance(v, list) else []


def parse_date(value: str) -> Optional[Tuple[int, int, bool]]:
    """(year, month, has_month) from "YYYY-MM" or "YYYY"; None when not a date."""
    m = DATE_RE.match(value or "")
    if not m:
        return None
    month = int(m.group(2)) if m.group(2) and 1 <= int(m.group(2)) <= 12 else 0
    return int(m.group(1)), month or 1, bool(month)


@dataclass
class Role:
    title: str = ""
    company: str = ""
    start: str = ""
    end: str = ""
    current: bool = False
    description: str = ""

    @property
    def bullets(self) -> List[str]:
        return bullets_of(self.description)


@dataclass
class Facts:
    name: str = ""
    headline: str = ""
    email: str = ""
    phone: str = ""
    location: str = ""
    links: str = ""  # LinkedIn or portfolio
    summary: str = ""
    roles: List[Role] = field(default_factory=list)
    projects: List[str] = field(default_factory=list)  # descriptions
    education: List[Tuple[str, str]] = field(default_factory=list)  # (start, end)
    skills: List[str] = field(default_factory=list)
    education_count: int = 0
    certification_count: int = 0
    other_count: int = 0
    project_count: int = 0

    @property
    def bullets(self) -> List[str]:
        """The achievement lines: every bullet of every job and project description."""
        out: List[str] = []
        for role in self.roles:
            out.extend(role.bullets)
        for text in self.projects:
            out.extend(bullets_of(text))
        return out

    def text(self) -> str:
        """All CV text in lower case, for whole-word matching."""
        parts = [self.headline, self.summary, " ".join(self.skills)]
        for role in self.roles:
            parts += [role.title, role.company, role.description]
        parts += self.projects
        return "\n".join(p for p in parts if p).lower()

    def sorted_roles(self, today: date) -> List[Role]:
        """Most recent first: current roles, then by end date, then start date."""
        def key(r: Role):
            end = parse_date(r.end)
            start = parse_date(r.start)
            end_key = (9999, 12) if r.current or not r.end else ((end[0], end[1]) if end else (0, 0))
            return (end_key, (start[0], start[1]) if start else (0, 0))
        return sorted(self.roles, key=key, reverse=True)

    def years_of_experience(self, today: date) -> float:
        """Years from the earliest role start to the latest role end (or today for a current role)."""
        starts, ends = [], []
        for r in self.roles:
            s = parse_date(r.start)
            if not s:
                continue
            starts.append(s[0] + (s[1] - 1) / 12)
            e = parse_date(r.end)
            if r.current or not r.end or not e:
                ends.append(today.year + (today.month - 1) / 12)
            else:
                ends.append(e[0] + (e[1] - 1) / 12)
        if not starts:
            return 0.0
        return max(max(ends) - min(starts), 0.0)


def bullets_of(text: str) -> List[str]:
    """Bulleted lines of a description; if it has no bullets, each non-empty line counts."""
    lines = [ln.strip() for ln in (text or "").splitlines() if ln.strip()]
    marked = [BULLET.sub("", ln).strip() for ln in lines if BULLET.match(ln)]
    return [b for b in marked if b] or [ln for ln in lines if ln]


def from_content(content: Optional[Dict[str, Any]]) -> Facts:
    """Facts from the canvas shape (frontend CvDraft; see export_service for the field names)."""
    c = content if isinstance(content, dict) else {}
    p = c.get("personal") if isinstance(c.get("personal"), dict) else {}
    facts = Facts(
        name=_s(p.get("name")), headline=_s(p.get("headline")), email=_s(p.get("email")),
        phone=_s(p.get("phone")), location=_s(p.get("location")),
        links=_s(p.get("linkedin")) or _s(p.get("portfolio")), summary=_s(c.get("summary")),
    )
    for e in _list(c.get("experience")):
        facts.roles.append(Role(
            title=_s(e.get("title")), company=_s(e.get("company")), start=_s(e.get("start")),
            end=_s(e.get("end")), current=e.get("current") == "true", description=_s(e.get("description")),
        ))
    facts.projects = [_s(e.get("description")) for e in _list(c.get("projects")) if _s(e.get("description"))]
    facts.project_count = len(_list(c.get("projects")))
    facts.education = [(_s(e.get("start")), _s(e.get("end"))) for e in _list(c.get("education"))]
    facts.education_count = len(facts.education)
    facts.skills = [s.strip() for s in c.get("skills", []) if isinstance(s, str) and s.strip()]
    facts.certification_count = len(_list(c.get("certifications")))
    facts.other_count = len(_list(c.get("others")))
    return facts


def content_from_resume(resume: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """The canvas shape from parser output (JSON Resume); the same mapping as the frontend's
    resumeToDraft, with only the fields the checks read."""
    r = resume if isinstance(resume, dict) else {}
    b = r.get("basics") if isinstance(r.get("basics"), dict) else {}
    loc = b.get("location") if isinstance(b.get("location"), dict) else {}
    linkedin = ""
    for pr in _list(b.get("profiles")):
        if _s(pr.get("network")).lower() == "linkedin":
            linkedin = _s(pr.get("url"))

    def text(summary: Any, highlights: Any) -> str:
        lines = [_s(summary)] + [f"• {_s(h)}" for h in (highlights if isinstance(highlights, list) else [])]
        return "\n".join(x for x in lines if x and x != "•")

    skills: List[str] = []
    for s in _list(r.get("skills")):
        kws = [k for k in (s.get("keywords") or []) if isinstance(k, str)]
        skills.extend(kws if kws else [_s(s.get("name"))])
    return {
        "personal": {
            "name": _s(b.get("name")), "headline": _s(b.get("label")), "email": _s(b.get("email")),
            "phone": _s(b.get("phone")), "linkedin": linkedin, "portfolio": _s(b.get("url")),
            "location": ", ".join(x for x in (_s(loc.get("city")), _s(loc.get("region")),
                                              _s(loc.get("countryCode"))) if x),
        },
        "summary": _s(b.get("summary")),
        "experience": [
            {"title": _s(w.get("position")), "company": _s(w.get("name")), "start": _s(w.get("startDate")),
             "end": "" if w.get("current") else _s(w.get("endDate")),
             "current": "true" if w.get("current") else "", "description": text(w.get("summary"), w.get("highlights"))}
            for w in _list(r.get("work"))
        ],
        "projects": [
            {"name": _s(p.get("name")), "description": text(p.get("description"), p.get("highlights"))}
            for p in _list(r.get("projects"))
        ],
        "education": [{"start": _s(e.get("startDate")), "end": _s(e.get("endDate"))}
                      for e in _list(r.get("education"))],
        "skills": skills,
        "certifications": [{"name": _s(c.get("name"))} for c in _list(r.get("certificates"))],
        "others": [{"kind": "x"} for k in ("languages", "awards", "volunteer", "interests") for _ in _list(r.get(k))],
    }
