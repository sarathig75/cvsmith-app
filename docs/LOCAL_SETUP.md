# CVSmith: run it locally on Windows (Docker)

Step-by-step guide for a fresh Windows 10/11 machine: install the tools, get the code, run
the whole app in Docker and test it in the browser. Commands are for **PowerShell**.

What runs locally (all in Docker, from `docker-compose.yml`):

| Container | What it is | Address on your PC |
|---|---|---|
| `cvsmith-frontend` | the website (Vite dev server) | http://localhost:5173 |
| `cvsmith-backend` | the API (FastAPI); also makes PDFs | http://localhost:8000 (docs: http://localhost:8000/docs) |
| `cvsmith-celery` | background worker that parses uploaded CVs | – |
| `cvsmith-postgres` | database | localhost:5432 |
| `cvsmith-redis` | queue between backend and worker | localhost:6379 |

Locally you log in with a 6-digit code that is printed in the backend log (no email needed),
invite-only mode is off, and Google sign-in is hidden.

---

## 1. One-time setup

### 1.1 Check Windows is ready
- Windows 10 (22H2) or Windows 11, 64-bit, at least 8 GB RAM (16 GB is more comfortable).
- Virtualisation must be on: Task Manager → Performance → CPU → "Virtualization: Enabled".
  If it says Disabled, turn on Intel VT-x / AMD-V (SVM) in the BIOS/UEFI settings.

### 1.2 Install WSL 2 (Docker needs it)
Open **PowerShell as Administrator** (Start → type PowerShell → right-click → Run as administrator):

```powershell
wsl --install --no-distribution
wsl --update
```

Restart the computer if it asks you to.

### 1.3 Install Git
Download from https://git-scm.com/download/win and run the installer with the default options
(or in PowerShell: `winget install --id Git.Git -e`). Then **open a new PowerShell window** and check:

```powershell
git --version
```

### 1.4 Install Docker Desktop
1. Download from https://www.docker.com/products/docker-desktop/ (or `winget install --id Docker.DockerDesktop -e`).
2. Run the installer. Choose **All users** if asked (needs admin rights) and keep
   **"Use WSL 2 instead of Hyper-V"** ticked. Docker only works for Windows accounts in the
   `docker-users` group; the installer adds the account that installs it. To use Docker from
   another account, in an admin PowerShell run
   `net localgroup docker-users "<Windows username>" /add`, then sign out and back in.
3. Restart if asked, then start **Docker Desktop** and accept the terms. Signing in to a Docker
   account is optional (you can skip it).
4. Wait until the bottom-left of Docker Desktop shows **"Engine running"** (green).
5. In a **new** PowerShell window:

```powershell
docker --version
docker compose version
docker run --rm hello-world
```

The last command should print "Hello from Docker!".

### 1.5 Get the code
The repository is public, so no login is needed to download it.

```powershell
cd $HOME\Documents
git clone https://github.com/sarathig75/cvsmith-app.git
cd cvsmith-app
```

The code is now in `Documents\cvsmith-app`. (To push code from this machine later, Git will open a
browser window to sign in to GitHub the first time.)

### 1.6 Create the `.env` file with the Claude API key
CV parsing and 💡 suggestions call Claude, so the backend needs an Anthropic API key.
Get one at https://console.anthropic.com → **API Keys** (you can reuse your existing key).

In PowerShell, inside `cvsmith-app`, run this with your own key in place of `sk-ant-...`:

```powershell
Set-Content -Path .env -Value "ANTHROPIC_API_KEY=sk-ant-..." -Encoding ascii
Get-Content .env
```

Notes:
- The file must be named exactly `.env` (not `.env.txt`) and sit in the `cvsmith-app` folder,
  next to `docker-compose.yml`. `-Encoding ascii` avoids the invisible "BOM" character that stops
  Docker from reading the file.
- Docker reads `.env` only when it creates the containers. If you create or change `.env`
  after the app has started, run `docker compose up -d` (not `restart`).
- `.env` is ignored by Git: it is never committed. Never paste the key into chat, code or documents.

---

### 1.7 Optional: Google sign-in
The Google button on the start page appears only when `GOOGLE_OAUTH_CLIENT_ID` is in `.env`.
Skip this section if email codes are enough.

1. In Google Cloud console (https://console.cloud.google.com) choose or create a project, e.g. "CVSmith".
   The Gemini API key is **not** this: sign-in needs an OAuth client ID.
2. **Google Auth Platform → Get started** (or **APIs & Services → OAuth consent screen**):
   app name `CVSmith`, support email your Gmail, audience **External**, then Create.
3. **Audience → Test users → Add users**: add every Gmail account that should sign in.
   While the app is in **Testing**, other accounts are blocked.
4. **Clients → Create client → Web application**:
   - **Authorized JavaScript origins:** `http://localhost:5173` (exactly: http, no trailing slash)
   - Redirect URIs: leave empty
   - Create, then copy the **Client ID** (ends in `.apps.googleusercontent.com`). Do not use the
     client secret (starts with `GOCSPX-`).
5. Add the ID to `.env` (keep the existing lines):
   ```powershell
   cd $HOME\Documents\cvsmith-app
   Add-Content -Path .env -Value "GOOGLE_OAUTH_CLIENT_ID=<your client id>" -Encoding ascii
   docker compose up -d
   ```
   Use `up -d`, not `restart`, so the containers read the new line.
6. Reload http://localhost:5173 with **Ctrl+F5**. The Google button appears.

Common errors:
- **`Error 401: invalid_client` / "The OAuth client was not found"**: the ID in `.env` does not
  match the console (placeholder left in, `< >` or quotes, partial copy, secret used instead).
  Check with `docker compose exec frontend printenv VITE_GOOGLE_OAUTH_CLIENT_ID`. A brand-new
  client can take a few minutes to start working.
- **`origin_mismatch`**: `http://localhost:5173` is missing from the origins; add it and save.
- **Access blocked / "has not completed the verification"**: the account is not in Test users.

## 2. Start the app

### 2.1 First start (builds the images; 5–15 minutes the first time)
Make sure Docker Desktop says "Engine running", then in `cvsmith-app`:

```powershell
docker compose up -d --build
```

Check that all five containers are up:

```powershell
docker compose ps
```

You should see `cvsmith-postgres`, `cvsmith-redis`, `cvsmith-backend`, `cvsmith-celery` and
`cvsmith-frontend` with status "Up" (postgres and redis also "healthy"). Database migrations run
automatically every time the backend starts.

### 2.2 Quick health check
- http://localhost:8000/api/health should show `{"status":"ok"}`.
- http://localhost:5173 should show the CVSmith start page.

If the backend isn't up yet, wait 20 seconds and reload; to see why, run `docker compose logs backend --tail 50`.

---

## 3. Test in the browser

### 3.1 Sign up / log in with an email code
1. Open http://localhost:5173 and enter any email address (it does not have to be real).
2. Get the 6-digit code from the backend log:

   ```powershell
   docker compose logs backend --tail 20
   ```

   Look for a line like `[dev email] login code for you@example.com: 123456`.
   The code is valid for 10 minutes and works once.
3. Type the code in the browser. You land on the canvas.

### 3.2 Checklist
- [ ] Start page shows, and the Privacy link opens `/privacy`.
- [ ] Log in with an email code (above).
- [ ] Upload a CV (PDF or DOCX, max 10 MB). The groups fill in as the worker parses it.
      (Real test CVs from your Drive are fine to use locally; just never commit them.)
- [ ] Edit a field: the status shows "Saving…" then "All changes saved"; reloading the page keeps the change.
- [ ] Move an entry up/down; delete an entry, reload, and check it stays deleted.
- [ ] 💡 on Headline / Summary / a job or project description gives a suggestion
      (Free plan: 1 per month; see 3.3 to test more).
- [ ] Download PDF works.
- [ ] Export JSON (Pro only; see 3.3).
- [ ] Settings: plan and usage show; log out and log back in with a new code.
- [ ] "Upload new CV" warns before replacing the current one.

### 3.3 Make your test account Pro (more suggestions, JSON export)
Replace the email with the one you logged in with:

```powershell
docker compose exec postgres psql -U cvsmith_user -d cvsmith_db -c "update users set plan='pro' where lower(email)=lower('you@example.com')"
```

It should reply `UPDATE 1`. Reload the browser.

---

## 4. Everyday use

| Task | Command (in `cvsmith-app`) |
|---|---|
| Start (Docker Desktop must be running) | `docker compose up -d` |
| Stop (keeps your data) | `docker compose stop` |
| Status | `docker compose ps` |
| Logs of one part | `docker compose logs backend --tail 50` (or `celery`, `frontend`) |
| Follow logs live | `docker compose logs -f backend` (Ctrl+C to stop following) |
| Get the latest code | `git pull` then `docker compose restart` |
| After a pull that changed `requirements.txt`, `package.json` or a `Dockerfile` | `docker compose up -d --build` |
| Wipe all local data (users, CVs) and start empty | `docker compose down -v` then `docker compose up -d` |

On Windows, code changes are not always picked up automatically, so after every `git pull`
run `docker compose restart`.

---

## 5. Troubleshooting

### 5.1 Collect a diagnostic file
If something fails and the table below doesn't solve it, run this block (copy all of it) and
send Claude the file it opens, `cvsmith-diag.txt`. It contains no secrets: only the *names* of
the settings in `.env`, "key set" or "key MISSING", container status and the latest logs.

```powershell
cd $HOME\Documents\cvsmith-app
& {
  "== git";        git log --oneline -1; git status --short
  "== .env files"; Get-ChildItem -Force -Name .env*
  "== .env names"; Get-Content .env | ForEach-Object { ($_ -split '=', 2)[0] }
  "== .env BOM";   if (((Get-Content .env -Encoding Byte -TotalCount 3) -join ',') -eq '239,187,191') { 'BOM present' } else { 'no BOM' }
  "== docker";     docker version --format '{{.Server.Version}}'
  "== containers"; docker compose ps -a
  "== keys"
  foreach ($s in 'backend', 'celery') {
    "$s : " + (docker compose exec -T $s sh -c 'case ${ANTHROPIC_API_KEY:-}${CVSMITH_CLAUDE_KEY:-} in ?*) echo key set;; *) echo key MISSING;; esac')
  }
  "frontend google id : " + (docker compose exec -T frontend sh -c 'case ${VITE_GOOGLE_OAUTH_CLIENT_ID:-} in ?*) echo set;; *) echo not set;; esac')
  "== health";     try { (Invoke-WebRequest -UseBasicParsing http://localhost:8000/api/health).Content } catch { "health check failed: $_" }
  foreach ($s in 'backend', 'celery', 'frontend') { "== logs $s"; docker compose logs --tail 60 $s }
} *>&1 | Out-File -Encoding utf8 cvsmith-diag.txt
notepad cvsmith-diag.txt
```

A red error on one line (for example `.env BOM` in PowerShell 7) is fine: the rest still runs.

### 5.2 Common problems

| Problem | Fix |
|---|---|
| `git` is not recognised | Close all PowerShell windows and open a new one. If it still fails, `Test-Path "C:\Program Files\Git\cmd\git.exe"`: `False` = install Git (1.3); `True` = rerun the Git installer and keep "Git from the command line and also from 3rd-party software". |
| `docker` is not recognised | Open a new PowerShell window after installing; check Docker Desktop is running. |
| "Cannot connect to the Docker daemon" / `failed to connect to the docker API at npipe:////./pipe/docker_engine` | Start Docker Desktop and wait for "Engine running". |
| Docker Desktop says WSL is missing or too old | Admin PowerShell: `wsl --update`, then restart Docker Desktop. |
| Docker Desktop won't start, virtualisation error | Enable VT-x / AMD-V in BIOS (see 1.1). |
| Warning `ANTHROPIC_API_KEY variable is not set` | `.env` is missing, misnamed (`.env.txt`) or in the wrong folder; recreate it as in 1.6, then `docker compose up -d`. |
| Upload fails with "Something went wrong" or "not available right now", and `docker compose logs celery` shows `Could not resolve authentication method` or `No Claude API key configured` | The containers have no API key. Check `Get-ChildItem -Force .env*` shows exactly `.env`; recreate it as in 1.6; then `docker compose up -d` (a `restart` does not re-read `.env`). Check with the `keys` lines of the diagnostic file (5.1). |
| Upload stays on "parsing" or fails | `docker compose logs celery --tail 50`: an authentication error means the API key is wrong; check `.env`, then `docker compose up -d`. |
| No login code in the log | Use `docker compose logs backend --tail 50` and request a new code (you can after 60 seconds). |
| "port is already allocated" (5432, 6379, 8000 or 5173) | Another program uses that port (often a locally installed PostgreSQL). Stop it, or run `docker compose down` and try again. |
| Site doesn't show your latest pulled code | `docker compose restart`; if dependencies changed, `docker compose up -d --build`. |
| PDF download fails | `docker compose logs backend --tail 50`; check the frontend container is up (`docker compose ps`). |
| Everything is odd | `docker compose down` then `docker compose up -d --build`. Your data stays unless you add `-v`. |

---

## 6. Optional: run the automated tests
These need nothing beyond Docker:

```powershell
docker compose exec backend pytest -q
docker compose exec frontend npm run test -- --run
```

---

Related: production server setup is in `docs/DEPLOY.md`. Session status is in `docs/HANDOFF.md`.
