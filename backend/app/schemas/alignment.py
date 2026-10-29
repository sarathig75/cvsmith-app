import uuid
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_serializer

from app.schemas.common import as_utc
from app.schemas.dashboard import AtsScoreOut


class JobSpecIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Length is checked in the service (after trimming) so the messages can be friendly.
    job_spec: str = Field(..., max_length=60000)


class SelectionIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    use_headline: bool = False
    skills: List[str] = Field(default_factory=list, max_length=40)


class RequirementsOut(BaseModel):
    job_title: str
    core_skills: List[str]
    secondary_skills: List[str]
    years_required: Optional[int] = None
    needs_management: bool
    sector: Optional[str] = None


class GapOut(BaseModel):
    skill: str
    importance: Literal["core", "secondary"]
    status: Literal["covered", "missing"]
    by_headline: bool = False


class PositioningOutSchema(BaseModel):
    current: str
    proposed: str


class AlignmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    requirements: RequirementsOut
    positioning: Optional[PositioningOutSchema] = None
    gaps: List[GapOut]
    consider: List[str]
    score: AtsScoreOut

    @field_serializer("created_at")
    def _ser_created(self, v: datetime) -> str:
        return as_utc(v).isoformat()
