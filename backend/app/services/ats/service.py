"""ATS scores for a saved CV: the "before" score (kept when the upload is parsed) and the current
one (computed on read from the saved CV and the layout of its generated PDF).

Contract: docs/API_CONTRACT.md ("Dashboard", "ATS format score"); rules: docs/ATS_FRAMEWORK.md.
Scoring never breaks the caller: a failure leaves the layout checks out (not applicable) or the
score empty, and is logged.
"""
import hashlib
import json
import logging
from datetime import date
from pathlib import PurePosixPath
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.models.cv import CV
from app.services import learning_service
from app.services.ats import facts as facts_mod
from app.services.ats import layout as layout_mod
from app.services.ats.score import ScoreResult, score_mode_a
from app.services.pdf_service import PdfError, PdfRenderer
from app.services.storage_service import StorageService

logger = logging.getLogger("cvsmith.ats")


def _record_unmatched(db: Session, result: ScoreResult) -> None:
    for kind, term in result.unmatched:
        learning_service.record_unmatched(db, kind, term)


def content_hash(content: Dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(content, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def save_before_score(db: Session, storage: StorageService, cv: CV, upload_key: str) -> None:
    """Score the uploaded file just parsed and keep the numbers (the file is deleted next).
    Unmatched terms are recorded here, once per upload, not on every read."""
    try:
        data = storage.read(upload_key)
        layout = layout_mod.from_file(data, PurePosixPath(upload_key).suffix.lower())
        result = score_mode_a(facts_mod.from_content(facts_mod.content_from_resume(cv.json_resume)), layout)
        cv.ats_before = {**result.public(), "layout": layout}
        db.commit()
        _record_unmatched(db, result)
    except Exception:  # noqa: BLE001 - the CV is parsed either way
        db.rollback()
        logger.exception("CV %s: could not compute the before ATS score", cv.id)


def after_layout(db: Session, cv: CV, renderer: PdfRenderer) -> Optional[Dict[str, Any]]:
    """Layout facts of the PDF made from the saved CV, kept until the content changes. Without saved
    content, the uploaded file's layout is used. None when no PDF could be made."""
    if not cv.content:
        return (cv.ats_before or {}).get("layout")
    digest = content_hash(cv.content)
    cached = cv.ats_layout_after
    if cached and cached.get("hash") == digest:
        return cached.get("layout")
    try:
        layout = layout_mod.from_pdf(renderer.render(cv.content))
    except PdfError:
        logger.warning("CV %s: PDF for the ATS score could not be made", cv.id)
        return None
    if layout is not None:
        cv.ats_layout_after = {"hash": digest, "layout": layout}
        db.commit()
    return layout


def current_score(db: Session, cv: CV, renderer: PdfRenderer, today: Optional[date] = None) -> Optional[Dict[str, Any]]:
    """Mode A score of the saved CV (or of the parsed upload, before the first save)."""
    content = cv.content or (facts_mod.content_from_resume(cv.json_resume) if cv.json_resume else None)
    if not content:
        return None
    try:
        layout = after_layout(db, cv, renderer)
        return score_mode_a(facts_mod.from_content(content), layout, today).public()
    except Exception:  # noqa: BLE001
        logger.exception("CV %s: could not compute the ATS score", cv.id)
        return None


def before_score(cv: CV) -> Optional[Dict[str, Any]]:
    b = cv.ats_before
    if not b:
        return None
    return {k: b[k] for k in ("score", "checks", "first_fix", "framework") if k in b}
