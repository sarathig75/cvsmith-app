import json
from pathlib import Path

from evals import checks
from evals.run_suggestions import CASES, prompt_hash

CASES_DATA = json.loads(Path(CASES).read_text(encoding="utf-8"))["cases"]


def test_case_set_is_the_agreed_size_and_covers_the_sectors():
    assert 20 <= len(CASES_DATA) <= 30
    sectors = {c["sector"] for c in CASES_DATA}
    for needed in ["human resources", "software", "finance", "sales", "operations", "manufacturing",
                   "automotive", "pharma", "fmcg", "fresher"]:
        assert needed in sectors, needed


def test_cases_are_well_formed_and_unique():
    ids = [c["id"] for c in CASES_DATA]
    assert len(ids) == len(set(ids))
    for c in CASES_DATA:
        assert c["field"] in ("summary", "experience", "projects", "headline")
        assert c["expect_changed"] in (True, False, None)
        assert isinstance(c["cv"], dict) and isinstance(c["context"], dict)


def test_cases_contain_no_contact_details():
    text = json.dumps(CASES_DATA)
    assert "@" not in text
    assert "+44" not in text and "+91" not in text


def test_numbers_must_come_from_the_field_or_the_cv():
    cv = {"experience": [{"description": "Cut costs by 30%"}]}
    assert checks.check_no_invented_numbers("Cut costs by 30%", "", cv)
    assert not checks.check_no_invented_numbers("Cut costs by 45%", "", cv)
    assert checks.check_no_invented_numbers("Grew 1,000 accounts", "grew 1000 accounts", None)


def test_first_person_is_caught_but_not_inside_words():
    assert not checks.check_no_first_person("I led the migration")
    assert not checks.check_no_first_person("Led the migration for my team")
    assert checks.check_no_first_person("Led the migration")
    assert checks.check_no_first_person("Meeting targets for the regional team")


def test_existing_summary_may_not_grow_past_one_and_a_half_times():
    assert checks.check_summary_not_longer("summary", "x" * 15, "x" * 10)
    assert not checks.check_summary_not_longer("summary", "x" * 16, "x" * 10)
    assert checks.check_summary_not_longer("experience", "x" * 100, "x" * 10)  # rule is for summaries
    assert checks.check_summary_not_longer("summary", "x" * 100, "")  # nothing to grow from
    assert checks.check_summary_not_longer("summary", "x" * 100, "x" * 10, "objective")  # replaced, not extended


def test_expected_change_is_only_checked_when_the_case_says_so():
    assert checks.check_expected_change(None, True) and checks.check_expected_change(None, False)
    assert checks.check_expected_change(True, True) and not checks.check_expected_change(True, False)
    assert checks.check_expected_change(False, False) and not checks.check_expected_change(False, True)


def test_run_checks_reports_each_check_by_name():
    case = {"field": "summary", "cv": {}, "expect_changed": True}
    result = checks.run_checks(case, "Led teams", True, "")
    assert set(result) == set(checks.CHECK_NAMES)
    assert all(result.values())


def test_capitalised_words_must_come_from_the_cv():
    cv = {"experience": [{"description": "Built reports in Power BI for Northwind Logistics"}]}
    assert checks.unlisted_capitalised("Built reports in Power BI", "", cv) == []
    assert checks.unlisted_capitalised("Used Tableau for Northwind Logistics", "", cv) == ["Tableau"]
    assert checks.unlisted_capitalised("Joined Contoso Ltd in 2019", "", cv) == ["Contoso", "Ltd"]


def test_sentence_and_bullet_starts_are_not_flagged():
    assert checks.unlisted_capitalised("Led the team. Delivered results. • Managed budgets", "", None) == []


def test_original_text_counts_as_listed():
    assert checks.unlisted_capitalised("Worked with Tableau", "I used Tableau daily", None) == []


def test_prompt_hash_is_stable_and_short():
    assert prompt_hash() == prompt_hash() and len(prompt_hash()) == 12


def test_a_change_is_decided_by_the_text_not_the_writers_flag():
    from app.services.suggestion_service import is_change
    assert is_change("Old summary", "New summary")
    assert not is_change("Old summary", "  old SUMMARY ")
    assert not is_change("Old", "")


def test_an_expansion_of_an_acronym_the_cv_uses_is_not_new():
    cv = {"experience": [{"description": "Prepared PPAP documents"}]}
    assert checks.unlisted_capitalised(
        "Prepared Production Part Approval Process (PPAP) documents", "", cv) == []
    assert checks.unlisted_capitalised(
        "Prepared Production Part Approval Process (SPC) documents", "", cv) != []


def test_an_acronym_spelled_out_after_it_is_not_new_either():
    cv = {"experience": [{"description": "Prepared PPAP documents"}]}
    assert checks.unlisted_capitalised(
        "Prepared PPAP (Production Part Approval Process) documents", "", cv) == []
