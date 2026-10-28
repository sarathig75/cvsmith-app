"""Automated checks on one suggestion. Pure functions: no API, no database.

Contract: docs/API_CONTRACT.md, "Evaluation set". Each check returns True when the suggestion passes.
"""
import json
import re
from typing import List, Optional

NUMBER = re.compile(r"\d+(?:[.,]\d+)?")
FIRST_PERSON = re.compile(r"\b(i|my|me|myself)\b", re.IGNORECASE)
SUMMARY_GROWTH_LIMIT = 1.5
WORD = re.compile(r"[A-Za-z][A-Za-z0-9+#./&-]*")
SENTENCE_BREAK = re.compile(r"[.!?;:\n•]+")
EXPANSION = re.compile(r"((?:[A-Za-z][A-Za-z-]*\s+){1,8}[A-Za-z][A-Za-z-]*)\s*\(([A-Za-z]{2,8})\)")
ACRONYM_FIRST = re.compile(r"\b([A-Za-z]{2,8})\s*\(((?:[A-Za-z][A-Za-z-]*\s+){1,8}[A-Za-z][A-Za-z-]*)\)")


def numbers_in(text: str) -> List[str]:
    return [n.replace(",", "") for n in NUMBER.findall(text)]


def ungrounded_numbers(suggested: str, original: str, cv: Optional[dict]) -> List[str]:
    """Numbers in the suggestion that appear neither in the field nor anywhere in the CV."""
    corpus = " ".join([original or "", json.dumps(cv or {}, ensure_ascii=False)])
    known = set(numbers_in(corpus))
    return [n for n in numbers_in(suggested) if n not in known]


def check_no_invented_numbers(suggested: str, original: str, cv: Optional[dict]) -> bool:
    return not ungrounded_numbers(suggested, original, cv)


def check_no_first_person(suggested: str) -> bool:
    return FIRST_PERSON.search(suggested) is None


def unlisted_capitalised(suggested: str, original: str, cv: Optional[dict]) -> List[str]:
    """Capitalised words in the suggestion that the candidate never wrote: a skill, employer or name we
    would be inventing. The first word of each sentence or bullet is skipped (it is capitalised anyway)."""
    corpus = " ".join([original or "", json.dumps(cv or {}, ensure_ascii=False)])
    known = set(WORD.findall(corpus.lower()))
    # House style rule 9: an acronym the CV uses may be spelled out, e.g. "Production Part Approval
    # Process (PPAP)". The words of such an expansion are not new.
    expansions = set()
    for match in EXPANSION.finditer(suggested):  # "Words (ACR)"
        if match.group(2) in known or match.group(2).lower() in known:
            expansions.update(WORD.findall(match.group(1)))
    for match in ACRONYM_FIRST.finditer(suggested):  # "ACR (Words)"
        if match.group(1) in known or match.group(1).lower() in known:
            expansions.update(WORD.findall(match.group(2)))
    unlisted = []
    for segment in SENTENCE_BREAK.split(suggested):
        words = WORD.findall(segment)
        for word in words[1:]:
            if word[0].isupper() and len(word) > 1 and word.lower() not in known and word not in unlisted \
                    and word not in expansions:
                unlisted.append(word)
    return unlisted


def check_no_unlisted_skills_or_employers(suggested: str, original: str, cv: Optional[dict]) -> bool:
    return not unlisted_capitalised(suggested, original, cv)


def check_summary_not_longer(field: str, suggested: str, original: str, kind: Optional[str] = None) -> bool:
    """A positioning statement is reworded, not extended: at most 1.5 times its length. An objective is
    replaced by a factual statement (house-style rule 14), so the limit does not apply to it."""
    if field != "summary" or not original.strip() or kind == "objective":
        return True
    return len(suggested) <= SUMMARY_GROWTH_LIMIT * len(original)


def check_expected_change(expected: Optional[bool], changed: bool) -> bool:
    return True if expected is None else changed == expected


def run_checks(case: dict, suggested: str, changed: bool, original: str) -> dict:
    """All checks for one case, as {name: passed}."""
    return {
        "no_invented_numbers": check_no_invented_numbers(suggested, original, case.get("cv")),
        "no_first_person": check_no_first_person(suggested),
        "summary_not_longer": check_summary_not_longer(case["field"], suggested, original, case.get("summary_kind")),
        "no_unlisted_skills_or_employers": check_no_unlisted_skills_or_employers(suggested, original, case.get("cv")),
        "expected_change": check_expected_change(case.get("expect_changed"), changed),
    }


CHECK_NAMES = ("no_invented_numbers", "no_first_person", "summary_not_longer", "expected_change",
               "no_unlisted_skills_or_employers")
