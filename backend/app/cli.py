"""Admin commands until there is an admin page (Week 10).

    python -m app.cli invites add a@example.com b@example.com --note "pilot"
    python -m app.cli invites remove a@example.com
    python -m app.cli invites list
    python -m app.cli users set-plan a@example.com pro      (free|pro; until billing exists, for testing)
    python -m app.cli suggestions report [--weeks 4]
    python -m app.cli unmatched report [--min-count 5]
    python -m app.cli unmatched ignore <kind> "<term>"
    python -m app.cli unmatched resolve <kind> "<term>"

On the server: docker compose -f deploy/docker-compose.prod.yml exec backend python -m app.cli ...
"""
import argparse
import sys
from typing import List, Optional

from app.database import SessionLocal
from sqlalchemy import select

from app.models.user import User
from app.services import invite_service, learning_service
from app.models.unmatched import UNMATCHED_KINDS


def _suggestions_report(weeks: int) -> int:
    with SessionLocal() as db:
        report = learning_service.suggestion_report(db, weeks=weeks)
    print("field\tweek (Monday)\taccepted\tdeclined\tunchanged\tpending\tedited_after_accept")
    for (field, week), c in sorted(report.items()):
        cols = [c["accepted"], c["declined"], c["unchanged"], c["pending"], c["edited_after_accept"]]
        print("\t".join([field, week] + [str(n) for n in cols]))
    if not report:
        print("(no changed suggestions in this period)")
    return 0


def _unmatched(args) -> int:
    with SessionLocal() as db:
        if args.action == "report":
            rows = learning_service.unmatched_report(db, min_count=args.min_count)
            for r in rows:
                print(f"{r.kind}\t{r.term}\t{r.count}\t{r.first_seen_at:%Y-%m-%d}\t{r.last_seen_at:%Y-%m-%d}")
            print(f"{len(rows)} open term(s) seen at least {args.min_count} times")
        else:
            status = "ignored" if args.action == "ignore" else "resolved"
            found = learning_service.set_unmatched_status(db, args.kind, args.term, status)
            print(f"{status}: {args.kind} '{args.term}'" if found else f"not found: {args.kind} '{args.term}'")
    return 0


def _set_plan(email: str, plan: str) -> int:
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email.strip().lower()))
        if user is None:
            print(f"not found: {email}")
            return 1
        user.plan = plan
        db.commit()
        print(f"{user.email}: plan is now {plan}")
    return 0


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(dest="group", required=True)
    invites = sub.add_parser("invites", help="who may sign up while INVITE_ONLY is on")
    actions = invites.add_subparsers(dest="action", required=True)
    add = actions.add_parser("add")
    add.add_argument("emails", nargs="+")
    add.add_argument("--note")
    rm = actions.add_parser("remove")
    rm.add_argument("emails", nargs="+")
    actions.add_parser("list")

    users = sub.add_parser("users", help="account settings for testing")
    users_actions = users.add_subparsers(dest="action", required=True)
    set_plan = users_actions.add_parser("set-plan")
    set_plan.add_argument("email")
    set_plan.add_argument("plan", choices=["free", "pro"])

    suggestions = sub.add_parser("suggestions", help="counts of what users did with suggestions")
    suggestions.add_argument("action", choices=["report"])
    suggestions.add_argument("--weeks", type=int, default=4)

    unmatched = sub.add_parser("unmatched", help="ATS terms the checks did not recognise")
    unmatched_actions = unmatched.add_subparsers(dest="action", required=True)
    report = unmatched_actions.add_parser("report")
    report.add_argument("--min-count", type=int, default=5)
    for name in ("ignore", "resolve"):
        term_action = unmatched_actions.add_parser(name)
        term_action.add_argument("kind", choices=UNMATCHED_KINDS)
        term_action.add_argument("term")
    args = parser.parse_args(argv)

    if args.group == "users":
        return _set_plan(args.email, args.plan)
    if args.group == "suggestions":
        return _suggestions_report(args.weeks)
    if args.group == "unmatched":
        return _unmatched(args)

    with SessionLocal() as db:
        if args.action == "add":
            done = invite_service.add(db, args.emails, args.note)
            print(f"Invited {len(done)}: {', '.join(done) or '(all were already invited)'}")
        elif args.action == "remove":
            done = invite_service.remove(db, args.emails)
            print(f"Removed {len(done)}: {', '.join(done) or '(none were invited)'}")
        else:
            rows = invite_service.list_all(db)
            for r in rows:
                print(f"{r.email}\t{r.created_at:%Y-%m-%d}\t{r.note or ''}")
            print(f"{len(rows)} invited")
    return 0


if __name__ == "__main__":
    sys.exit(main())
