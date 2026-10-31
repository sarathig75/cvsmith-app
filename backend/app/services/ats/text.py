"""Small text helpers for the checks: verbs, metrics, filler phrases, whole-word matching."""
import re
from typing import Dict, List, Set

from app.services.ats.lists import ACTION_VERBS, ALIASES, FILLER_PHRASES, WEAK_OPENERS

# Present and other forms of verbs that are listed in the past tense (or irregular).
_IRREGULAR_FORMS = {
    "built": ("build", "builds", "building"), "led": ("lead", "leads", "leading"),
    "drove": ("drive", "drives", "driving"), "grew": ("grow", "grows", "growing"),
    "cut": ("cuts", "cutting"), "forecast": ("forecasts", "forecasting"),
    "oversaw": ("oversee", "oversees", "overseeing"), "wrote": ("write", "writes", "writing"),
}


def _forms(word: str) -> Set[str]:
    """The listed word and the other forms of the same verb (managed -> manage, manages, managing).
    Over-generating junk strings is harmless: only a bullet's first word is looked up."""
    forms = {word, *_IRREGULAR_FORMS.get(word, ())}
    if word.endswith("ied"):
        bases = {word[:-3] + "y"}
    elif word.endswith("ed"):
        bases = {word[:-1], word[:-2], word[:-3]}  # manage, deliver, plan (from planned)
    else:
        bases = set()
    for base in bases:
        forms.update({base, base + "s", base + "es", base + "ing"})
        if base.endswith("e"):
            forms.add(base[:-1] + "ing")
        if base.endswith("y"):
            forms.add(base[:-1] + "ies")
    return forms


_VERB_FORMS: Dict[str, str] = {}
for _verb in ACTION_VERBS:
    for _form in _forms(_verb):
        _VERB_FORMS.setdefault(_form, _verb)
_WEAK = set(WEAK_OPENERS)
_WORD = re.compile(r"[A-Za-z][A-Za-z'\-]*")
_YEAR = re.compile(r"\b(19|20)\d{2}\b")
_MONTHS = re.compile(r"\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b", re.I)


def first_word(bullet: str) -> str:
    m = _WORD.search(bullet)
    return m.group(0).lower() if m else ""


def is_strong_verb(word: str) -> bool:
    return word in _VERB_FORMS


def looks_like_unlisted_verb(word: str) -> bool:
    """A first word worth recording for review: a past-tense verb that is neither listed nor weak."""
    return len(word) > 4 and word.endswith("ed") and word not in _VERB_FORMS and word not in _WEAK


def has_metric(bullet: str) -> bool:
    """A number, percentage or currency amount. A year used as a date does not count."""
    text = _MONTHS.sub(" ", _YEAR.sub(" ", bullet))
    return bool(re.search(r"\d", text)) or bool(re.search(r"[%$£€₹]", text))


def filler_count(bullet: str) -> int:
    low = bullet.lower()
    return sum(len(re.findall(r"(?<![a-z])" + re.escape(p) + (r"(?![a-z])" if p[-1].isalpha() else ""), low))
               for p in FILLER_PHRASES)


def word_count(bullet: str) -> int:
    return len(bullet.split())


def contains_term(haystack: str, term: str) -> bool:
    """Whole-word match of a term (lower case) in text (lower case)."""
    pattern = r"(?<![a-z0-9])" + re.escape(term) + r"(?![a-z0-9])"
    return re.search(pattern, haystack) is not None


def skill_forms(skill: str) -> List[str]:
    """The skill itself and, if it is on the alias list (as canonical or as an alias), every form."""
    s = " ".join(skill.lower().split())
    for canonical, others in ALIASES.items():
        if s == canonical or s in others:
            return [canonical, *others]
    return [s]


def skill_in(haystack: str, skill: str) -> bool:
    return any(contains_term(haystack, form) for form in skill_forms(skill) if form)


def skill_is_known(skill: str) -> bool:
    s = " ".join(skill.lower().split())
    return any(s == c or s in o for c, o in ALIASES.items())


def normalise_title(title: str) -> str:
    return " ".join(re.sub(r"[^a-z0-9 ]", " ", title.lower().replace("&", " and ")).split())
