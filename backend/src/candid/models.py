import uuid
from datetime import date
from typing import Optional

from sqlmodel import Field, SQLModel


def _uid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


class Candidate(SQLModel, table=True):
    id: str = Field(default_factory=lambda: _uid("c"), primary_key=True)
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    current_role: Optional[str] = None
    years_of_experience: Optional[int] = None
    location: Optional[str] = None
    status: str = Field(default="new")  # new | screening | pre | eval | final | offer
    source: Optional[str] = None
    applied_at: str = Field(default_factory=lambda: date.today().isoformat())
    score: Optional[float] = None
    cv_text: Optional[str] = None
    cv_filename: Optional[str] = None
    job_title: Optional[str] = None
    job_description: Optional[str] = None
    # JSON: {strengths[], weaknesses[], questions[], extracted{}}
    ai_pre_analysis: Optional[str] = None
    extra_information: Optional[str] = None


class Interview(SQLModel, table=True):
    id: str = Field(default_factory=lambda: _uid("i"), primary_key=True)
    candidate_id: str = Field(foreign_key="candidate.id", index=True)
    type: str = "Manual Paste"  # "Live Recording" | "Manual Paste"
    title: Optional[str] = None
    interviewer: Optional[str] = None
    date: Optional[str] = None
    duration: Optional[str] = None
    raw_content: Optional[str] = None
    cleaned_transcript: Optional[str] = None
    ai_summary: Optional[str] = None
    extra_info: Optional[str] = None


class Evaluation(SQLModel, table=True):
    id: str = Field(default_factory=lambda: _uid("e"), primary_key=True)
    candidate_id: str = Field(foreign_key="candidate.id", unique=True, index=True)
    human_skills: Optional[str] = None   # JSON: {"Communication": 4, ...}
    technical_skills: Optional[str] = None  # JSON: {"Domain Knowledge": 5, ...}
    final_recommendation: str = "Pending"
    notes: Optional[str] = None


class Config(SQLModel, table=True):
    id: int = Field(default=1, primary_key=True)
    provider: str = "openai"
    model_name: str = "gpt-4o"
    encrypted_api_key: Optional[str] = None


class ApiKey(SQLModel, table=True):
    """One row per AI provider; stores the encrypted API key."""
    __tablename__ = "api_key"

    provider: str = Field(primary_key=True)   # openai | anthropic | gemini | groq
    encrypted_key: Optional[str] = None


class Role(SQLModel, table=True):
    id: str = Field(default_factory=lambda: _uid("r"), primary_key=True)
    name: str
    department: Optional[str] = None
    description: Optional[str] = None
    headcount: int = Field(default=1)  # approved headcount


class JobDescription(SQLModel, table=True):
    __tablename__ = "job_description"

    id: str = Field(default_factory=lambda: _uid("jd"), primary_key=True)
    role_id: str = Field(foreign_key="role.id", index=True)
    title: str
    description: Optional[str] = None
    requirements: Optional[str] = None
    location: Optional[str] = None
    remote_ok: bool = False
    status: str = "Draft"   # Active | On hold | Draft | Closed
    openings: int = 1
    owner: Optional[str] = None


class Employee(SQLModel, table=True):
    id: str = Field(default_factory=lambda: _uid("emp"), primary_key=True)
    first_name: str
    last_name: str
    email: Optional[str] = None
    role_id: Optional[str] = Field(default=None, foreign_key="role.id", index=True)
    role_name: Optional[str] = None     # denormalized for display
    department: Optional[str] = None
    salary: Optional[float] = None
    currency: str = "USD"
    hire_date: Optional[str] = None
    location: Optional[str] = None
    manager: Optional[str] = None
