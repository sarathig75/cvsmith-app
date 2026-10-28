"""Automated checks on one suggestion. Pure functions: no API, no database.

Contract: docs/API_CONTRACT.md, "Evaluation set". Each check returns True when the suggestion passes.
"""
import json
import re
from typing import List, Optional

NUMBER = re.compile(r"\d+(?:[.,]\d+)?")
FIRST_PERSON = re.compile(r"\b(i|my|me|myself)\b", re.IGNORECASE)
SUMMARY_GROWTH_LIMIT = 1.5


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


def check_summary_not_longer(field: str, suggested: str, original: str) -> bool:
    """An existing summary is reworded, not extended: at most 1.5 times its length."""
    if field != "summary" or not original.strip():
        return True
    return len(suggested) <= SUMMARY_GROWTH_LIMIT * len(original)


def check_flag_matches_text(changed: bool, suggested: str, original: str) -> bool:
    """If the writer says nothing changed, the text must be the same. Otherwise the user gets nothing."""
    return changed or suggested.strip() == original.strip()


def check_expected_change(expected: Optional[bool], changed: bool) -> bool:
    return True if expected is None else changed == expected


def run_checks(case: dict, suggested: str, changed: bool, original: str) -> dict:
    """All checks for one case, as {name: passed}."""
    return {
        "no_invented_numbers": check_no_invented_numbers(suggested, original, case.get("cv")),
        "no_first_person": check_no_first_person(suggested),
        "summary_not_longer": check_summary_not_longer(case["field"], suggested, original),
        "expected_change": check_expected_change(case.get("expect_changed"), changed),
        "flag_matches_text": check_flag_matches_text(changed, suggested, original),
    }


CHECK_NAMES = ("no_invented_numbers", "no_first_person", "summary_not_longer", "expected_change",
               "flag_matches_text")
