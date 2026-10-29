FROM python:3.11-slim

# A slow connection (about 100 kB/s was seen) needs patient downloads: longer timeout, more retries.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PIP_DEFAULT_TIMEOUT=120 \
    PIP_RETRIES=10 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT=120000

WORKDIR /app

COPY requirements.txt .
# The cache mount keeps downloaded packages between builds, so a build that fails part-way resumes
# instead of downloading everything again. It is not part of the image.
RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements.txt
# Chromium (and its system libraries and fonts) for PDF download.
RUN playwright install --with-deps chromium

COPY . .

RUN useradd --create-home appuser && mkdir -p /app/uploads && chown -R appuser /app/uploads
USER appuser

EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
