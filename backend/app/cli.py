"""Admin commands until there is an admin page (Week 10).

    python -m app.cli invites add a@example.com b@example.com --note "pilot"
    python -m app.cli invites remove a@example.com
    python -m app.cli invites list

On the server: docker compose -f deploy/docker-compose.prod.yml exec backend python -m app.cli ...
"""
import argparse
import sys
from typing import List, Optional

from app.database import SessionLocal
from app.services import invite_service


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
    args = parser.parse_args(argv)

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
