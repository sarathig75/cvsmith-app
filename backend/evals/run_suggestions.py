"""Run the suggestion evaluation set against the real Claude API.

    cd backend && python -m evals.run_suggestions [--case ID]

Costs API credits, so it is never run by pytest or CI. Needs ANTHROPIC_API_KEY or CVSMITH_CLAUDE_KEY.
Each run writes evals/results/<date>-<prompt hash>.json (git-ignored) so prompt versions can be compared.
"""
import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from app.services import suggestion_service
from app.utils.errors import AppError
from app.services.suggestion_service import ClaudeSuggestionWriter, SuggestionError, is_change, prepare_request
from evals.checks import CHECK_NAMES, run_checks

HERE = Path(__file__).resolve().parent
CASES = HERE / "cases.json"
RESULTS = HERE / "results"


def prompt_hash() -> str:
    text = suggestion_service.HOUSE_STYLE + suggestion_service.TASK
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:12]


def run(only: str = None, repeats: int = 1) -> dict:
    data = json.loads(CASES.read_text(encoding="utf-8"))
    writer = ClaudeSuggestionWriter()
    results = []
    for attempt, case in ((a, c) for a in range(1, repeats + 1) for c in data["cases"]):
        if only and case["id"] != only:
            continue
        try:
            text, context = prepare_request(case["field"], case["text"], case["context"], case["cv"])
        except AppError as exc:
            # Production refuses this request (422) before any AI call: there is no suggestion.
            text, suggested, changed, refused = case["text"].strip(), "", False, exc.message
        else:
            try:
                suggested, changed = writer.write(case["field"], text, context)
            except SuggestionError:
                # The API failed (e.g. no credit): recorded, and the run carries on.
                results.append({"run": attempt, "id": case["id"], "field": case["field"], "changed": False,
                                "refused": "api error", "suggested": "", "checks": {}, "passed": False})
                print(f"run {attempt} {case['id']:<30} API ERROR")
                continue
            suggested = " ".join(suggested.split()) if case["field"] == "headline" else suggested.strip()
            changed = is_change(text, suggested)  # the decision production makes
            refused = None
        checks = run_checks(case, suggested, changed, text)
        results.append({"run": attempt, "id": case["id"], "field": case["field"], "changed": changed,
                        "refused": refused, "suggested": suggested, "checks": checks,
                        "passed": all(checks.values())})
        verdict = "PASS" if all(checks.values()) else "FAIL"
        failed = ", ".join(k for k, v in checks.items() if not v)
        print(f"run {attempt} {case['id']:<30} {verdict}  {failed}")
    summary = {name: sum(1 for r in results if r["checks"].get(name)) for name in CHECK_NAMES}
    report = {"run_at": datetime.now(timezone.utc).isoformat(), "prompt_hash": prompt_hash(),
              "model": writer.model, "repeats": repeats, "cases": len(results),
              "passed_per_check": summary, "results": results}
    return report


def save(report: dict) -> Path:
    RESULTS.mkdir(exist_ok=True)
    name = f"{report['run_at'][:10]}-{report['prompt_hash']}.json"
    path = RESULTS / name
    path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    return path


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="python -m evals.run_suggestions")
    parser.add_argument("--case", help="run one case id")
    parser.add_argument("--repeats", type=int, default=1, help="runs of each case (the output varies)")
    args = parser.parse_args(argv)
    report = run(args.case, args.repeats)
    path = save(report)
    print(f"\n{report['cases']} result(s) over {report['repeats']} run(s)")
    print(f"passed per check: {report['passed_per_check']}")
    print(f"Saved {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
