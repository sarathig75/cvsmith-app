import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_serializer

from app.schemas.common import as_utc

SuggestionField = Literal["summary", "experience", "projects"]


class SuggestionContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field("", max_length=200)
    company: str = Field("", max_length=200)


class SuggestionIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    field: SuggestionField
    entry_id: Optional[str] = Field(None, max_length=64)
    # Length is checked in the service (after trimming) so the message can be friendly.
    text: str = Field(..., max_length=20000)
    context: SuggestionContext = SuggestionContext()


class SuggestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    field: SuggestionField
    entry_id: Optional[str] = None
    original: str = Field(validation_alias="original_text")
    suggested: str = Field(validation_alias="suggested_text")
    changed: bool
    status: Literal["pending", "accepted", "declined", "unchanged"]
    created_at: datetime

    @field_serializer("created_at")
    def _ser_created(self, v: datetime) -> str:
        return as_utc(v).isoformat()


class DecisionIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["accepted", "declined"]


class QuotaOut(BaseModel):
    plan: Literal["free", "pro"]
    limit: int
    used: int
    remaining: int
    resets_at: datetime

    @field_serializer("resets_at")
    def _ser_resets(self, v: datetime) -> str:
        return as_utc(v).isoformat()
