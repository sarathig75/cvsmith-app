---
name: handoff
description: Read or write the CVSmith session handoff note (docs/HANDOFF.md). Use at the start of a session to pick up where the last one stopped ("read the handoff", "continue", "where were we"), and at the end of a session or before a long break to record state ("write the handoff", "update handoff notes", "wrap up").
---

# CVSmith session handoff

The handoff note lives at `docs/HANDOFF.md` in this repo. It is the single place that
tells the next session what state the project is in. Keep it short (aim for under ~80 lines):
it is a status note, not a design doc. Long-lived decisions belong in `docs/API_CONTRACT.md`
or `docs/CVSmith_Release_1_FINAL_PLAN.md`; the handoff only links to them.

## Reading (start of session)

1. `git fetch origin && git checkout main && git pull` so you read the latest note.
2. Read `docs/HANDOFF.md` in full.
3. Check the note against reality before acting on it: does the last commit it names exist
   (`git log --oneline -5`)? Are the open branches it lists still open? If the note and the
   repo disagree, tell the user what differs instead of guessing which is right.
4. Summarise for the user in a few lines: current state, the next step the note proposes,
   and any open questions it lists. Ask before starting work if an open question blocks it.

## Writing (end of session)

1. Run the checks so the note states facts, not hopes:
   - backend: `cd backend && .venv/bin/pytest && .venv/bin/flake8`
   - frontend: `cd frontend && npm run type-check && npm run test -- --run && npm run build`
   If a check was not run, say so in the note.
2. Rewrite `docs/HANDOFF.md` (replace it; do not append a log) using the template below.
   Fill every section; write "none" where a section is empty.
3. Never put secrets, API keys, tokens or passwords in the note. Name the env var instead
   (e.g. "needs `ANTHROPIC_API_KEY` in backend/.env").
4. Commit it with the session's other work (or alone as `docs: update handoff`), push, and
   tell the user the commit hash.

## Template

```markdown
# CVSmith handoff

Updated: <YYYY-MM-DD> · Last commit on main: <short hash> <subject>

## Product decisions (stable)
- <one line each; only decisions a new session must not undo>

## Current state
- Backend: <tests passed/total, flake8 status>
- Frontend: <type-check / tests / build status>
- Open branches / PRs: <name → purpose, or "none">

## Done this session
- <bullet per meaningful change, with commit hash>

## Next steps
1. <ordered, concrete, each small enough to start immediately>

## Open questions for the user
- <decision needed, options, and the recommendation if there is one>

## Setup notes
- <anything non-obvious needed to run things: env vars by name, services, commands>
```
