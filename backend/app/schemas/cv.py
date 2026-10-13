import json
import uuid
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, field_serializer, field_validator

from app.schemas.common import as_utc

ParsePart = Literal["basics", "experience", "extras"]


class CVOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    privacy: Literal["private", "public"]
    parsing_status: Literal["not_uploaded", "pending", "in_progress", "complete", "failed"]
    parsing_error: Optional[str] = None
    parsing_parts: Dict[str, Literal["pending", "complete", "failed"]]
    json_resume: Dict[str, Any] = {}
    content: Optional[Dict[str, Any]] = None
    applied_parts: List[ParsePart] = []
    content_updated_at: Optional[datetime] = None
    created_at: datetime

    @field_serializer("created_at")
    def _ser_created(self, v: datetime) -> str:
        return as_utc(v).isoformat()

    @field_serializer("content_updated_at")
    def _ser_content_updated(self, v: Optional[datetime]) -> Optional[str]:
        return as_utc(v).isoformat() if v else None


MAX_CONTENT_BYTES = 256 * 1024


class CVSave(BaseModel):
    """Body of PATCH /api/cv: the canvas exactly as the frontend keeps it (opaque to the server)."""

    model_config = ConfigDict(extra="forbid")

    content: Dict[str, Any]
    applied_parts: List[ParsePart] = []
    edited: bool = False

    @field_validator("content")
    @classmethod
    def _not_too_large(cls, v: Dict[str, Any]) -> Dict[str, Any]:
        if len(json.dumps(v, separators=(",", ":")).encode()) > MAX_CONTENT_BYTES:
            raise ValueError("CV content is too large to save.")
        return v

    @field_validator("applied_parts")
    @classmethod
    def _unique(cls, v: List[str]) -> List[str]:
        return sorted(set(v))
