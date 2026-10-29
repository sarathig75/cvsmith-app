from typing import List, Literal, Optional

from pydantic import BaseModel


class SectionOut(BaseModel):
    key: Literal["contact", "summary", "experience", "education", "skills", "projects", "others"]
    label: str
    points: int
    max: int
    complete: bool


class NextStepOut(BaseModel):
    section: str
    text: str
    points: int


class CvStrengthOut(BaseModel):
    percent: int
    sections: List[SectionOut]
    next_step: Optional[NextStepOut] = None


class AtsCheckOut(BaseModel):
    id: str
    label: str
    passed: bool
    points: float
    max: int
    fix: Optional[str] = None


class FirstFixOut(BaseModel):
    check_id: str
    text: str
    points: int


class AtsScoreOut(BaseModel):
    score: int
    checks: List[AtsCheckOut]
    first_fix: Optional[FirstFixOut] = None
    framework: str


class DashboardOut(BaseModel):
    state: Literal["no_cv", "parsing", "ready", "needs_details"]
    cv_strength: Optional[CvStrengthOut] = None
    ats: Optional[AtsScoreOut] = None
    plan: Literal["free", "pro"]


class AtsOut(BaseModel):
    """before: the uploaded file (kept when it was parsed); after: the saved CV as the Classic PDF."""
    before: Optional[AtsScoreOut] = None
    after: Optional[AtsScoreOut] = None
