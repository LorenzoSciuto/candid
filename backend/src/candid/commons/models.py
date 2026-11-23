import uuid
from datetime import UTC, date, datetime

from sqlmodel import Field, SQLModel


def _uid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex}"   # full 128-bit id: never guessable


# ── Users & Organizations ─────────────────────────────────────────────────────

class User(SQLModel, table=True):
    id: str = Field(primary_key=True)           # Google sub
    email: str = Field(unique=True, index=True)
    name: str
    picture: str | None = None
    title: str | None = None                 # job title / role shown in profile
    department: str | None = None
    created_at: str = Field(default_factory=lambda: date.today().isoformat())


class Organization(SQLModel, table=True):
    id: str = Field(default_factory=lambda: _uid("org"), primary_key=True)
    name: str
    slug: str = Field(unique=True, index=True)
    owner_id: str
    created_at: str = Field(default_factory=lambda: date.today().isoformat())
    branding_config: str | None = None   # JSON: {primary_color, bg_color, logo_url, ...}


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
    accepted_at: str | None = None


# ── Per-org AI config ─────────────────────────────────────────────────────────

class OrgConfig(SQLModel, table=True):
    __tablename__ = "org_config"
    org_id: str = Field(primary_key=True)
    provider: str = "openai"
    model_name: str = "gpt-4o"
    stages_json: str | None = None          # JSON list of {id, label, dot}
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password_encrypted: str | None = None
    smtp_from: str | None = None
    date_format: str = Field(default="dd/MM/yyyy")
    currency: str = Field(default="EUR")
    locations_json: str | None = None       # JSON list of office locations offered in forms


class OrgApiKey(SQLModel, table=True):
    __tablename__ = "org_api_key"
    id: str = Field(default_factory=lambda: _uid("ak"), primary_key=True)
    org_id: str = Field(index=True)
    provider: str = Field(index=True)
    encrypted_key: str | None = None


# ── Recruiting entities (all scoped to org_id) ────────────────────────────────

class Candidate(SQLModel, table=True):
    id: str = Field(default_factory=lambda: _uid("c"), primary_key=True)
    org_id: str = Field(default="", index=True)
    first_name: str
    last_name: str
    email: str | None = None
    phone: str | None = None
    current_role: str | None = None
    years_of_experience: int | None = None
    location: str | None = None
    status: str = Field(default="new")
    source: str | None = None
    applied_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    score: float | None = None
    cv_text: str | None = None
    cv_filename: str | None = None
    job_title: str | None = None
    # JSON: {overview, strengths[], weaknesses[], questions[], extracted{}, career_history[], role_fits[]}
    ai_pre_analysis: str | None = None
    # JSON: [{title, company, period, description}]
    career_history: str | None = None
    # JSON: [{status, at, by}]
    status_history: str | None = None
    # ISO timestamp of last AI analysis run
    analysis_at: str | None = None
    # JSON: [{type, at, note}] — append-only audit log
    activity_log: str | None = None
    cv_file: bytes | None = None
    job_description_id: str | None = Field(default=None, foreign_key="job_description.id", index=True)


class Interview(SQLModel, table=True):
    id: str = Field(default_factory=lambda: _uid("i"), primary_key=True)
    org_id: str = Field(default="", index=True)
    candidate_id: str | None = Field(default=None, foreign_key="candidate.id", index=True)
    type: str = "Manual Paste"
    title: str | None = None
    interviewer: str | None = None
    date: str | None = None
    time: str | None = None
    duration: str | None = None
    raw_content: str | None = None
    cleaned_transcript: str | None = None
    ai_summary: str | None = None
    extra_info: str | None = None
    audio_file_path: str | None = None
    transcript_raw: str | None = None
    transcript_status: str | None = None
    transcript_language: str | None = None
    ai_evaluation: str | None = None


class Evaluation(SQLModel, table=True):
    id: str = Field(default_factory=lambda: _uid("e"), primary_key=True)
    org_id: str = Field(default="", index=True)
    candidate_id: str = Field(foreign_key="candidate.id", unique=True, index=True)
    human_skills: str | None = None         # JSON: {"Communication": 4, ...}
    technical_skills: str | None = None     # JSON: {"Domain Knowledge": 5, ...}
    final_recommendation: str = "Pending"
    notes: str | None = None
    updated_at: str | None = None


class Role(SQLModel, table=True):
    id: str = Field(default_factory=lambda: _uid("r"), primary_key=True)
    org_id: str = Field(default="", index=True)
    name: str
    department: str | None = None
    description: str | None = None
    headcount: int = Field(default=1)


class JobDescription(SQLModel, table=True):
    __tablename__ = "job_description"

    id: str = Field(default_factory=lambda: _uid("jd"), primary_key=True)
    org_id: str = Field(default="", index=True)
    role_id: str = Field(foreign_key="role.id", index=True)
    title: str
    description: str | None = None
    requirements: str | None = None
    location: str | None = None
    status: str = "Draft"
    openings: int = 1
    owner: str | None = None
    salary_min: int | None = None
    salary_max: int | None = None
    salary_currency: str = "EUR"


class Employee(SQLModel, table=True):
    id: str = Field(default_factory=lambda: _uid("emp"), primary_key=True)
    org_id: str = Field(default="", index=True)
    first_name: str
    last_name: str
    email: str | None = None
    role_id: str | None = Field(default=None, foreign_key="role.id", index=True)
    role_name: str | None = None
    department: str | None = None
    salary: float | None = None
    currency: str = "EUR"
    hire_date: str | None = None
    location: str | None = None
    manager: str | None = None
    candidate_id: str | None = None
    notes: str | None = None
    reminder_note: str | None = None
    reminder_active: bool = Field(default=False)
    reminder_created_at: str | None = None


# ── Notifications ─────────────────────────────────────────────────────────────

class Notification(SQLModel, table=True):
    id: str = Field(default_factory=lambda: _uid("ntf"), primary_key=True)
    org_id: str = Field(index=True)
    user_id: str = Field(index=True)
    category: str                   # "candidate" | "analysis" | "interview" | "invitation" | "reminder"
    title: str
    body: str
    entity_id: str                  # ID of the related entity
    entity_type: str                # "candidate" | "interview" | "invitation" | "employee"
    is_read: bool = Field(default=False)
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class EmailLog(SQLModel, table=True):
    __tablename__ = "email_log"
    id: str = Field(default_factory=lambda: _uid("em"), primary_key=True)
    org_id: str = Field(index=True)
    direction: str                           # "sent" | "received"
    to_email: str | None = None
    from_email: str | None = None
    subject: str
    body: str = ""
    email_type: str = "general"              # "rejection" | "invitation" | "general" | "manual"
    candidate_id: str | None = Field(None, index=True)
    sent_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class PerformanceReview(SQLModel, table=True):
    __tablename__ = "performance_review"

    id: str = Field(default_factory=lambda: _uid("pr"), primary_key=True)
    org_id: str = Field(default="", index=True)
    employee_id: str = Field(foreign_key="employee.id", index=True)
    period: str
    self_evaluation: str | None = None
    manager_feedback: str | None = None
    rating: str | None = None
    action_goals: str | None = None        # JSON array of goal strings
    next_review_date: str | None = None    # ISO date
    created_at: str = Field(default_factory=lambda: date.today().isoformat())


# ── Video Interview Portal ────────────────────────────────────────────────────

class VideoInterview(SQLModel, table=True):
    __tablename__ = "video_interview"

    id: str = Field(default_factory=lambda: _uid("vi"), primary_key=True)
    org_id: str = Field(index=True)
    candidate_id: str = Field(index=True)
    invite_token: str = Field(unique=True, index=True)
    questions: str  # JSON list of question strings
    status: str = Field(default="pending")  # pending | in_progress | completed | expired
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    expires_at: str
    started_at: str | None = None
    completed_at: str | None = None


class VideoResponse(SQLModel, table=True):
    __tablename__ = "video_response"

    id: str = Field(default_factory=lambda: _uid("vr"), primary_key=True)
    video_interview_id: str = Field(index=True)
    question_index: int
    status: str = Field(default="recording")  # recording | uploading | complete
    total_chunks: int | None = None
    received_chunks: int = Field(default=0)
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    completed_at: str | None = None
