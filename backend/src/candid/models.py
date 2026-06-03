import uuid
from datetime import date, datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


def _uid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


# ── Users & Organizations ─────────────────────────────────────────────────────

class User(SQLModel, table=True):
    id: str = Field(primary_key=True)           # Google sub
    email: str = Field(unique=True, index=True)
    name: str
    picture: Optional[str] = None
    title: Optional[str] = None                 # job title / role shown in profile
    department: Optional[str] = None
    created_at: str = Field(default_factory=lambda: date.today().isoformat())


class Organization(SQLModel, table=True):
    id: str = Field(default_factory=lambda: _uid("org"), primary_key=True)
    name: str
    slug: str = Field(unique=True, index=True)
    owner_id: str
    created_at: str = Field(default_factory=lambda: date.today().isoformat())


class Membership(SQLModel, table=True):
    id: str = Field(default_factory=lambda: _uid("mbr"), primary_key=True)
    org_id: str = Field(index=True)
    user_id: str = Field(index=True)
    role: str = "member"                        # "owner" | "admin" | "member"
    joined_at: str = Field(default_factory=lambda: date.today().isoformat())


class Invitation(SQLModel, table=True):
    id: str = Field(default_factory=lambda: _uid("inv"), primary_key=True)
    org_id: str = Field(index=True)
    email: str = Field(index=True)
    token: str = Field(unique=True, index=True)
    role: str = "member"
    invited_by: str
    created_at: str = Field(default_factory=lambda: date.today().isoformat())
    expires_at: str
    accepted_at: Optional[str] = None


# ── Per-org AI config ─────────────────────────────────────────────────────────

class OrgConfig(SQLModel, table=True):
    __tablename__ = "org_config"
    org_id: str = Field(primary_key=True)
    provider: str = "openai"
    model_name: str = "gpt-4o"
    stages_json: Optional[str] = None          # JSON list of {id, label, dot}


class OrgApiKey(SQLModel, table=True):
    __tablename__ = "org_api_key"
    id: str = Field(default_factory=lambda: _uid("ak"), primary_key=True)
    org_id: str = Field(index=True)
    provider: str = Field(index=True)
    encrypted_key: Optional[str] = None


# ── Recruiting entities (all scoped to org_id) ────────────────────────────────

class Candidate(SQLModel, table=True):
    id: str = Field(default_factory=lambda: _uid("c"), primary_key=True)
    org_id: str = Field(default="", index=True)
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    current_role: Optional[str] = None
    years_of_experience: Optional[int] = None
    location: Optional[str] = None
    status: str = Field(default="new")
    source: Optional[str] = None
    applied_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    score: Optional[float] = None
    cv_text: Optional[str] = None
    cv_filename: Optional[str] = None
    job_title: Optional[str] = None
    job_description: Optional[str] = None
    # JSON: {overview, strengths[], weaknesses[], questions[], extracted{}, career_history[], role_fits[]}
    ai_pre_analysis: Optional[str] = None
    # JSON: [{title, company, period, description}]
    career_history: Optional[str] = None
    # JSON: [{status, at, by}]
    status_history: Optional[str] = None
    extra_information: Optional[str] = None
    cv_file: Optional[bytes] = None
    otp_hash: Optional[str] = None          # SHA-256 hex digest of the 6-digit OTP
    otp_expires_at: Optional[str] = None    # ISO datetime string (UTC)


class Interview(SQLModel, table=True):
    id: str = Field(default_factory=lambda: _uid("i"), primary_key=True)
    org_id: str = Field(default="", index=True)
    candidate_id: str = Field(foreign_key="candidate.id", index=True)
    type: str = "Manual Paste"
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
    org_id: str = Field(default="", index=True)
    candidate_id: str = Field(foreign_key="candidate.id", unique=True, index=True)
    human_skills: Optional[str] = None         # JSON: {"Communication": 4, ...}
    technical_skills: Optional[str] = None     # JSON: {"Domain Knowledge": 5, ...}
    final_recommendation: str = "Pending"
    notes: Optional[str] = None
    updated_at: Optional[str] = None


class Role(SQLModel, table=True):
    id: str = Field(default_factory=lambda: _uid("r"), primary_key=True)
    org_id: str = Field(default="", index=True)
    name: str
    department: Optional[str] = None
    description: Optional[str] = None
    headcount: int = Field(default=1)


class JobDescription(SQLModel, table=True):
    __tablename__ = "job_description"

    id: str = Field(default_factory=lambda: _uid("jd"), primary_key=True)
    org_id: str = Field(default="", index=True)
    role_id: str = Field(foreign_key="role.id", index=True)
    title: str
    description: Optional[str] = None
    requirements: Optional[str] = None
    location: Optional[str] = None
    remote_ok: bool = False
    status: str = "Draft"
    openings: int = 1
    owner: Optional[str] = None


class Employee(SQLModel, table=True):
    id: str = Field(default_factory=lambda: _uid("emp"), primary_key=True)
    org_id: str = Field(default="", index=True)
    first_name: str
    last_name: str
    email: Optional[str] = None
    role_id: Optional[str] = Field(default=None, foreign_key="role.id", index=True)
    role_name: Optional[str] = None
    department: Optional[str] = None
    salary: Optional[float] = None
    currency: str = "EUR"
    hire_date: Optional[str] = None
    location: Optional[str] = None
    manager: Optional[str] = None
    candidate_id: Optional[str] = None
    notes: Optional[str] = None
    reminder_note: Optional[str] = None
    reminder_active: bool = Field(default=False)
    reminder_created_at: Optional[str] = None


class Notification(SQLModel, table=True):
    id: str = Field(default_factory=lambda: _uid("notif"), primary_key=True)
    org_id: str = Field(default="", index=True)
    notification_type: str = "info"
    message: str = ""
    reference_id: Optional[str] = None
    is_read: bool = Field(default=False)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class PerformanceReview(SQLModel, table=True):
    __tablename__ = "performance_review"

    id: str = Field(default_factory=lambda: _uid("pr"), primary_key=True)
    org_id: str = Field(default="", index=True)
    employee_id: str = Field(foreign_key="employee.id", index=True)
    period: str
    self_evaluation: Optional[str] = None
    manager_feedback: Optional[str] = None
    rating: Optional[str] = None
    action_goals: Optional[str] = None        # JSON array of goal strings
    next_review_date: Optional[str] = None    # ISO date
    created_at: str = Field(default_factory=lambda: date.today().isoformat())
