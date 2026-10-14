"""Contact details found by pattern in CV text: instant, no AI (the "contact" parsing part).

Only fields with an unambiguous written form are taken: email, phone and a LinkedIn URL.
Name, headline and location need the AI. When in doubt a field is left out: the AI part
"basics" fills it moments later.
"""
import re
from typing import Any, Dict, Optional

_EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}")
# A run of digits with the separators phone numbers use; filtered below.
_PHONE = re.compile(r"(?<![\w/.])\+?\(?\d[\d\s().-]{7,}\d(?![\w/])")
_YEAR_RANGE = re.compile(r"\b(?:19|20)\d{2}\s*[-–]\s*(?:19|20)\d{2}\b")
_LINKEDIN = re.compile(r"(?:https?://)?(?:[a-z]{2,3}\.)?linkedin\.com/in/[A-Za-z0-9_%-]+/?", re.IGNORECASE)


def _phone(text: str) -> Optional[str]:
    candidates = []
    for m in _PHONE.finditer(text):
        raw = " ".join(m.group(0).split())
        digits = re.sub(r"\D", "", raw)
        if not 10 <= len(digits) <= 15 or _YEAR_RANGE.search(raw):
            continue
        candidates.append(raw)
    # A number written with a country code is the strongest signal.
    return next((c for c in candidates if c.startswith("+")), candidates[0] if candidates else None)


def find_contact(text: str) -> Dict[str, Any]:
    """JSON Resume fragment with whatever was found: {"basics": {...}} or {}."""
    basics: Dict[str, Any] = {}
    email = _EMAIL.search(text)
    if email:
        basics["email"] = email.group(0)
    phone = _phone(text)
    if phone:
        basics["phone"] = phone
    linkedin = _LINKEDIN.search(text)
    if linkedin:
        basics["profiles"] = [{"network": "LinkedIn", "url": linkedin.group(0).rstrip("/")}]
    return {"basics": basics} if basics else {}
