import uuid
from datetime import datetime
from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, ConfigDict, field_serializer

from app.schemas.common import as_utc


class CVOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    privacy: Literal["private", "public"]
    parsing_status: Literal["pending", "in_progress", "complete", "failed"]
    parsing_error: Optional[str] = None
    parsing_parts: Dict[str, Literal["pending", "complete", "failed"]]
    json_resume: Dict[str, Any] = {}
    created_at: datetime

    @field_serializer("created_at")
    def _ser_created(self, v: datetime) -> str:
        return as_utc(v).isoformat()
