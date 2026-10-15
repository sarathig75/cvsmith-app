# CVSmith backend

FastAPI + SQLAlchemy 2.0 + Alembic. Implements `docs/API_CONTRACT.md`.

## Setup
```bash
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
```

## Run
```bash
uvicorn app.main:app --reload --port 8000
# http://localhost:8000/api/health, docs at /docs
```
SQLite is used by default (`DATABASE_URL=sqlite:///./cvsmith.db`); set a
`postgresql+psycopg2://...` URL for production.

### CV parsing worker
Uploads return immediately; parsing runs in a Celery worker (Redis broker) that extracts
text (pypdf / python-docx) and asks Claude to structure it as JSON Resume. Scanned PDFs with
no text layer are sent to Claude as a PDF. Needs `ANTHROPIC_API_KEY` (or `CVSMITH_CLAUDE_KEY`,
for hosts that reserve `ANTHROPIC_*` names, such as Claude Code cloud environments) and a running Redis:
```bash
redis-server                                   # or: docker compose up redis
celery -A app.workers.celery_app worker --loglevel=info
```
The model is set by `CLAUDE_MODEL` (default `claude-sonnet-5-5`). Pipeline code is in
`app/services/parsing_service.py`; the Claude call is in `app/services/cv_parser.py`.
If Redis is unreachable, the upload still succeeds and the CV is marked `failed` with a
"please upload again" message.

In any `ENVIRONMENT` other than `development`, the app refuses to start unless
`JWT_SECRET` is a non-default value of at least 32 characters.

### Login (one-time email codes)
Release 1 has no passwords: `POST /api/auth/code` emails a 6-digit code and
`POST /api/auth/code/verify` logs in (the first login creates the account). The email provider
is a setting, `EMAIL_PROVIDER`:
- `log` (default without a key): the code is written to the backend log, development only.
  With Docker: `docker compose logs backend --tail 20`.
- `sendgrid`: set `SENDGRID_API_KEY`.
- `smtp`: any SMTP service (Resend, Brevo, Mailgun, Amazon SES): set `SMTP_HOST`, `SMTP_PORT`,
  `SMTP_USERNAME`, `SMTP_PASSWORD`.
Set `EMAIL_FROM` to an address on a domain you verified with the provider. Login requests are
rate-limited with Redis (skipped if Redis is down). Sessions last 7 days without activity.

### PDF download
`GET /api/cv/download` prints the frontend's `print.html` (the Classic template) with headless
Chromium, so the frontend must be running at `PDF_TEMPLATE_URL` (default `FRONTEND_URL`).
Install the browser once: `playwright install chromium` (the Docker image does this), or point
`PDF_CHROMIUM_PATH` at an existing Chromium.

## Test
```bash
pytest
flake8 app tests
```
Tests use a temporary SQLite database and upload directory; no external services needed
(Celery, Redis, email, Chromium and the Claude API are replaced with fakes). GitHub Actions
runs the same checks on every push (`.github/workflows/ci.yml`).

## Notes
- Google sign-in needs `GOOGLE_OAUTH_CLIENT_ID`; verification is in `app/services/google_service.py`.
- Uploads are stored under `UPLOAD_DIR/<user_id>/<random>.<ext>` via `app/services/storage_service.py`
  and deleted once parsing has finished (cloud storage such as S3 comes with hosting, Week 12).

## Docker
Development: `docker compose up` from the repository root. Production (pilot): see
`docs/DEPLOY.md` and `deploy/` (Caddy with HTTPS, production settings, nightly backups,
invite-only; any Linux server with Docker).
