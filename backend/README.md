# CVSmith backend

FastAPI + SQLAlchemy 2.0 + Alembic. Implements `docs/API_CONTRACT.md`.

## Setup
```bash
python3.11 -m venv venv && source venv/bin/activate
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

In any `ENVIRONMENT` other than `development`, the app refuses to start unless
`JWT_SECRET` is a non-default value of at least 32 characters.

## Test
```bash
pytest
flake8 app tests
```
Tests use a temporary SQLite database and upload directory; no external services needed.

## Notes
- Google sign-in needs `GOOGLE_OAUTH_CLIENT_ID`; verification is in `app/services/google_service.py`.
- Without `SENDGRID_API_KEY` the email verification link is logged (development only).
- Uploads are stored under `UPLOAD_DIR/<user_id>/<random>.<ext>` via `app/services/storage_service.py`
  (swap for S3 later).

## Docker
```bash
docker build -t cvsmith-api . && docker run -p 8000:8000 --env-file .env cvsmith-api
```
