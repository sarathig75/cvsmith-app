---
name: local-troubleshoot
description: Diagnose problems with the user's local CVSmith setup (Windows, PowerShell, Docker Desktop, docker compose) in as few round trips as possible. Use whenever the user reports that something fails or looks wrong when running CVSmith locally - install errors (git, WSL, Docker), containers not starting, upload or parsing errors, missing login codes, 💡 suggestion or PDF failures, Google sign-in errors, "it doesn't work" - or pastes an error message, log or command output from their machine.
---

# CVSmith local troubleshooting

The user runs CVSmith on a Windows PC with Docker Desktop, following `docs/LOCAL_SETUP.md`.
You cannot see their machine: every fact comes from output they paste. The goal is to find the
cause in one or two round trips, not five.

## How to work

1. **Match the symptom first.** If the user's message already contains an error, look it up in
   the table below and give the fix straight away, with one check that confirms it worked.
2. **If the cause is not clear, ask for the diagnostic file in one go** (next section) instead
   of asking for one command at a time.
3. **Ask for output, not commands.** If the user sends only the command they ran, say so in one
   line and ask them to paste what PowerShell printed (or attach the file from step 2).
4. **Never ask for secrets.** Never request `.env` contents, `docker compose config` (it prints
   the keys) or the API key. Use the "key set / key MISSING" checks. A Google OAuth client ID
   is not a secret; a client secret (`GOCSPX-…`) and the Anthropic key (`sk-ant-…`) are.
5. **Separate "their machine" from "our code".** If the failure might be in the code (e.g. one
   CV fails to parse), reproduce it in the cloud container with the same input before changing
   anything: see "Reproducing here" below.
6. **Give PowerShell commands that run from the `cvsmith-app` folder** (`cd
   $HOME\Documents\cvsmith-app`), one per block, with what the user should expect to see.
   Avoid double quotes inside `sh -c '…'` arguments: Windows PowerShell 5.1 can strip them.
7. **After a new problem is solved**, add it to the table below and to section 5 of
   `docs/LOCAL_SETUP.md`, so it is answered in one step next time.

## Diagnostic file (one paste)

Ask the user to run the block in `docs/LOCAL_SETUP.md` section 5.1 ("Collect a diagnostic
file") and attach `cvsmith-diag.txt`. It prints no secrets: only `.env` variable *names*, and
"set"/"MISSING" for keys. Logs can contain the test email addresses they used. If the block
changes, keep the reading notes below in step with it.

How to read it:
- `.env files` must list exactly `.env`; `.env names` must include `ANTHROPIC_API_KEY`
  (and `GOOGLE_OAUTH_CLIENT_ID` if Google sign-in is wanted); `BOM present` = recreate `.env`.
- `docker` empty or an error = Docker Desktop engine not running.
- `containers`: all five (postgres, redis, backend, celery, frontend) should be "Up";
  an "Exited" one → its log section shows why.
- `keys`: MISSING while `.env` looks right = containers were created before `.env` was
  fixed → `docker compose up -d`.

## Symptom → cause → fix

| Symptom (what the user sees) | Cause | Fix / check |
|---|---|---|
| `git` / `docker` "is not recognized as the name of a cmdlet" | Not installed, or PowerShell window opened before installing | New PowerShell window. Git: `Test-Path "C:\Program Files\Git\cmd\git.exe"` → False = install (`winget install --id Git.Git -e`); True = rerun installer, keep "Git from the command line and also from 3rd-party software". |
| `failed to connect to the docker API at npipe:////./pipe/docker_engine` / "Cannot connect to the Docker daemon" | Docker Desktop not started | Open Docker Desktop, wait for "Engine running", retry `docker run --rm hello-world`. |
| Docker Desktop: WSL missing/outdated, or a virtualization error | WSL 2 not installed/updated, or VT-x/AMD-V off | Admin PowerShell: `wsl --update`, restart Docker Desktop. Task Manager → CPU → "Virtualization: Enabled", else enable in BIOS. |
| `no configuration file provided` | Command run outside the `cvsmith-app` folder | `cd $HOME\Documents\cvsmith-app` |
| `port is already allocated` (5432/6379/8000/5173) | Another program uses the port (often a local PostgreSQL) | Stop that program, or `docker compose down` then `up -d`. |
| Warning `The "ANTHROPIC_API_KEY" variable is not set` | `.env` missing, named `.env.txt`, in the wrong folder, or has a BOM | Recreate: `Set-Content -Path .env -Value "ANTHROPIC_API_KEY=sk-ant-..." -Encoding ascii` (re-add other lines with `Add-Content … -Encoding ascii`), then `docker compose up -d`. |
| Upload → "Something went wrong while processing your CV"; celery log `TypeError: Could not resolve authentication method` (old code) or `No Claude API key configured` + "not available right now" (since 7f13e02) | Containers have no API key | As above; `restart` does NOT re-read `.env`, `up -d` does. Confirm with the `keys` lines of the diagnostic file. |
| Upload → "The CV parsing service returned an error" | Claude API rejected the call | Celery log line `Claude API error <status> (request <id>)` shows only the status code. 401 = key wrong or revoked → create a new key. Otherwise first check the account has credit (console → Billing), then ask for the request id and status. |
| Upload → "could not be reached" | No internet from Docker / proxy / firewall | Check internet; `docker compose exec celery python -c "import urllib.request;print(urllib.request.urlopen('https://api.anthropic.com').status)"` (any HTTP error code = reachable). |
| Upload → "Something went wrong…" with another traceback in the celery log | A bug in our code | Get the full traceback, then reproduce here (below). |
| Upload stays "parsing" for minutes | Celery worker down or stuck | `docker compose ps` (celery Up?), `docker compose logs celery --tail 60`, then `docker compose restart celery`. |
| No login code | Looking in the wrong place, or email provider configured | `docker compose logs backend --tail 50`, look for `[dev email] login code for …`. Codes last 10 min; a new one after 60 s. |
| Google button missing on the start page | `GOOGLE_OAUTH_CLIENT_ID` not in `.env` (by design the button is hidden without it) | Create a Web OAuth client in Google Cloud (Google Auth Platform → Clients), origin `http://localhost:5173`, add the user as a test user; `Add-Content -Path .env -Value "GOOGLE_OAUTH_CLIENT_ID=…" -Encoding ascii`; `docker compose up -d`. A Gemini API key is not an OAuth client. |
| Google: `Error 401: invalid_client` / "The OAuth client was not found" | Wrong ID (placeholder, `< >`, quotes, partial copy, the `GOCSPX-` secret, another project, two lines) or a brand-new client not active yet | `docker compose exec frontend printenv VITE_GOOGLE_OAUTH_CLIENT_ID` vs the console; fix `.env`, `docker compose up -d`, Ctrl+F5; else wait ~5 min. |
| Google: `origin_mismatch` / "not a valid origin" | `http://localhost:5173` not in the client's Authorized JavaScript origins | Add it exactly (http, no trailing slash), save, wait a few minutes. |
| Google: "Access blocked: app has not completed the Google verification process" / access denied | Consent screen in Testing and the account is not a test user | Google Auth Platform → Audience → add the account as a test user. |
| PDF download fails | Frontend container down, or Chromium error in the backend | `docker compose ps`; `docker compose logs backend --tail 60`. |
| Pulled new code but the site looks old | Windows bind mounts don't always trigger reload | `docker compose restart`; if dependencies changed, `docker compose up -d --build`. |
| "Pro only" for JSON export / suggestions used up | Free plan limits | Make the account Pro: `docs/LOCAL_SETUP.md` 3.3. |

## Reproducing here (cloud container)

When the cause may be in the code, run the same step here with the real code before
changing anything. Example used for a parse failure:
`cd backend && .venv/bin/pip install -r requirements.txt` (if `.venv` is missing), then call
`app.services.text_extraction.extract_text` and `app.services.cv_parser.get_parser().parse_text`
on the file the user attached. `CVSMITH_CLAUDE_KEY` is set in this environment.
- Works here, fails there → their environment (key, versions, network): compare, e.g.
  `docker compose exec celery pip show anthropic` against `.venv/bin/pip show anthropic`.
- Fails here too → a code bug: fix it with a test, run the checks, then ask the user to
  `git pull` and `docker compose restart`.
- CVs the user shares may be real people's: use them only to reproduce, never commit them or
  copy their contents into code, tests or docs.
