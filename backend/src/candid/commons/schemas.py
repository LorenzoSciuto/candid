from typing import Optional

from pydantic import BaseModel, Field, field_validator

# ── Candidates ─────────────────────────────────────────────────────────────────

class CandidateCreate(BaseModel):
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    current_role: Optional[str] = None
    years_of_experience: Optional[int] = None
    location: Optional[str] = None
    status: str = "new"
    source: Optional[str] = None
    cv_text: Optional[str] = None
    cv_filename: Optional[str] = None
    job_description_id: Optional[str] = None


class CandidateUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    current_role: Optional[str] = None
    years_of_experience: Optional[int] = None
    location: Optional[str] = None
    status: Optional[str] = None
    source: Optional[str] = None
    score: Optional[float] = None
    cv_text: Optional[str] = None
    cv_filename: Optional[str] = None
    job_description_id: Optional[str] = None


# ── Analysis ───────────────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    candidate_id: Optional[str] = None
    job_title: str
    job_description: Optional[str] = None
    cv_text: str
    notes: Optional[str] = None


class QuickAddRequest(BaseModel):
    text: str


# ── Interviews ──────────────────────────────────────────────────────────────────

class InterviewCreate(BaseModel):
    candidate_id: Optional[str] = None
    type: str = "Manual Paste"
    title: Optional[str] = None
    interviewer: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    raw_content: Optional[str] = None


class InterviewUpdate(BaseModel):
    title: Optional[str] = None
    interviewer: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    duration: Optional[str] = None
    raw_content: Optional[str] = None
    cleaned_transcript: Optional[str] = None
    ai_summary: Optional[str] = None


class InterviewProcess(BaseModel):
    raw_content: str


class InterviewSummarize(BaseModel):
    text: str


# ── Evaluations ─────────────────────────────────────────────────────────────────

class EvaluationUpsert(BaseModel):
    candidate_id: str
    human_skills: Optional[dict] = None
    technical_skills: Optional[dict] = None
    final_recommendation: str = "Pending"
    notes: Optional[str] = None


# ── Config ──────────────────────────────────────────────────────────────────────

class ConfigUpdate(BaseModel):
    provider: str
    model_name: str
    api_key: Optional[str] = None


class ApiKeyUpsert(BaseModel):
    provider: str                           # openai | anthropic | gemini | groq
    api_key: str                            # plaintext; backend encrypts


class EmailConfigUpdate(BaseModel):
    smtp_host: Optional[str] = None
    smtp_port: int = 587
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None    # plaintext; backend encrypts; None = keep existing
    smtp_from: Optional[str] = None


class EmailConfigResponse(BaseModel):
    smtp_host: Optional[str] = None
    smtp_port: int = 587
    smtp_user: Optional[str] = None
    smtp_password_set: bool = False
    smtp_from: Optional[str] = None


DATE_FORMATS = ("dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd")
CURRENCIES = ("EUR", "USD", "GBP", "CHF", "JPY", "CAD", "AUD", "SEK", "DKK", "NOK")
DEFAULT_LOCATIONS = ["Remote"]


class PreferencesUpdate(BaseModel):
    """Organisation-wide display preferences. Omitted fields are left unchanged."""
    date_format: Optional[str] = None
    currency: Optional[str] = None
    locations: Optional[list[str]] = Field(None, max_length=100)


class PreferencesResponse(BaseModel):
    date_format: str = "dd/MM/yyyy"
    currency: str = "EUR"
    locations: list[str] = Field(default_factory=lambda: list(DEFAULT_LOCATIONS))


class GoogleAuthRequest(BaseModel):
    token: str                              # Google ID token from GIS


class SwitchOrgRequest(BaseModel):
    org_id: str


# ── Branding ─────────────────────────────────────────────────────────────────────

class BrandingConfig(BaseModel):
    primary_color: Optional[str] = None
    background_color: Optional[str] = None
    font_family: Optional[str] = None
    logo_url: Optional[str] = None


_HEX_COLOR = r"^#[0-9a-fA-F]{3,8}$"
_FONT_NAME = r"^[\w\s,'\"-]{1,100}$"
_MAX_LOGO_CHARS = 700_000          # ~500 KB image as a data URL


class BrandingUpdate(BaseModel):
    """Rendered on the public job portal, so every field is validated strictly."""
    primary_color: Optional[str] = Field(None, pattern=_HEX_COLOR)
    background_color: Optional[str] = Field(None, pattern=_HEX_COLOR)
    font_family: Optional[str] = Field(None, pattern=_FONT_NAME)
    logo_url: Optional[str] = Field(None, max_length=_MAX_LOGO_CHARS)

    @field_validator("logo_url")
    @classmethod
    def _logo_must_be_https_or_inline_image(cls, value: Optional[str]) -> Optional[str]:
        if value and not value.startswith(("https://", "data:image/png", "data:image/jpeg",
                                           "data:image/gif", "data:image/webp", "data:image/svg+xml")):
            raise ValueError("logo_url must be an https:// URL or an inline PNG/JPEG/GIF/WebP/SVG image")
        return value


# ── Organizations ────────────────────────────────────────────────────────────────

class OrgCreate(BaseModel):
    name: str


class InviteRequest(BaseModel):
    email: str
    role: str = "member"                    # "admin" | "member"


# ── Roles ───────────────────────────────────────────────────────────────────────

class RoleCreate(BaseModel):
    name: str
    department: Optional[str] = None
    description: Optional[str] = None
    headcount: int = 1


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    description: Optional[str] = None
    headcount: Optional[int] = None


# ── Job Descriptions ────────────────────────────────────────────────────────────

class JobDescriptionCreate(BaseModel):
    role_id: str
    title: str
    description: Optional[str] = None
    requirements: Optional[str] = None
    location: Optional[str] = None
    status: str = "Draft"
    openings: int = 1
    owner: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    salary_currency: str = "EUR"


class JobDescriptionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None
    openings: Optional[int] = None
    owner: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    salary_currency: Optional[str] = None


class ImproveJDRequest(BaseModel):
    text: str
    role_name: str = ""


# ── Employees ───────────────────────────────────────────────────────────────────

class EmployeeCreate(BaseModel):
    first_name: str
    last_name: str
    email: Optional[str] = None
    role_id: Optional[str] = None
    role_name: Optional[str] = None
    department: Optional[str] = None
    salary: Optional[float] = None
    currency: str = "USD"
    hire_date: Optional[str] = None
    location: Optional[str] = None
    manager: Optional[str] = None
    candidate_id: Optional[str] = None


class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    role_id: Optional[str] = None
    role_name: Optional[str] = None
    department: Optional[str] = None
    salary: Optional[float] = None
    location: Optional[str] = None
    manager: Optional[str] = None
    hire_date: Optional[str] = None


class EmployeeNotesUpdate(BaseModel):
    notes: str


class EmployeeReminderSet(BaseModel):
    note: str


# ── Public Job Portal ────────────────────────────────────────────────────────

class PublicJobItem(BaseModel):
    id: str
    title: str
    location: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[str] = None
    openings: int
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    salary_currency: str = "EUR"


class PublicJobListResponse(BaseModel):
    org_id: str
    org_name: str
    branding: Optional[dict] = None
    jobs: list[PublicJobItem]


class PortalApplicationRequest(BaseModel):
    cv_text: Optional[str] = None


class PortalApplicationResponse(BaseModel):
    ok: bool
    candidate_id: str


# ── Performance Reviews ──────────────────────────────────────────────────────────

class ImproveReviewTextRequest(BaseModel):
    text: str
    field: str = "manager_feedback"            # "manager_feedback" | "self_evaluation"


class PerformanceReviewCreate(BaseModel):
    period: str
    self_evaluation: Optional[str] = None
    manager_feedback: Optional[str] = None
    rating: Optional[str] = None
    action_goals: Optional[str] = None
    next_review_date: Optional[str] = None


class PerformanceReviewUpdate(BaseModel):
    period: Optional[str] = None
    self_evaluation: Optional[str] = None
    manager_feedback: Optional[str] = None
    rating: Optional[str] = None
    action_goals: Optional[str] = None
    next_review_date: Optional[str] = None


# ── Video Interviews ─────────────────────────────────────────────────────────

class VideoInterviewCreate(BaseModel):
    candidate_id: str
    questions: list[str]


class CompleteResponseRequest(BaseModel):
    total_chunks: int
