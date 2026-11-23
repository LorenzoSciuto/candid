
from pydantic import BaseModel, Field, field_validator

# ── Candidates ─────────────────────────────────────────────────────────────────

class CandidateCreate(BaseModel):
    first_name: str
    last_name: str
    email: str | None = None
    phone: str | None = None
    current_role: str | None = None
    years_of_experience: int | None = None
    location: str | None = None
    status: str = "new"
    source: str | None = None
    cv_text: str | None = None
    cv_filename: str | None = None
    job_description_id: str | None = None


class CandidateUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    phone: str | None = None
    current_role: str | None = None
    years_of_experience: int | None = None
    location: str | None = None
    status: str | None = None
    source: str | None = None
    score: float | None = None
    cv_text: str | None = None
    cv_filename: str | None = None
    job_description_id: str | None = None


# ── Analysis ───────────────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    candidate_id: str | None = None
    job_title: str
    job_description: str | None = None
    cv_text: str
    notes: str | None = None


class QuickAddRequest(BaseModel):
    text: str


# ── Interviews ──────────────────────────────────────────────────────────────────

class InterviewCreate(BaseModel):
    candidate_id: str | None = None
    type: str = "Manual Paste"
    title: str | None = None
    interviewer: str | None = None
    date: str | None = None
    time: str | None = None
    raw_content: str | None = None


class InterviewUpdate(BaseModel):
    title: str | None = None
    interviewer: str | None = None
    date: str | None = None
    time: str | None = None
    duration: str | None = None
    raw_content: str | None = None
    cleaned_transcript: str | None = None
    ai_summary: str | None = None


class InterviewProcess(BaseModel):
    raw_content: str


class InterviewSummarize(BaseModel):
    text: str


# ── Evaluations ─────────────────────────────────────────────────────────────────

class EvaluationUpsert(BaseModel):
    candidate_id: str
    human_skills: dict | None = None
    technical_skills: dict | None = None
    final_recommendation: str = "Pending"
    notes: str | None = None


# ── Config ──────────────────────────────────────────────────────────────────────

class ConfigUpdate(BaseModel):
    provider: str
    model_name: str
    api_key: str | None = None


class ApiKeyUpsert(BaseModel):
    provider: str                           # openai | anthropic | gemini | groq
    api_key: str                            # plaintext; backend encrypts


class EmailConfigUpdate(BaseModel):
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None    # plaintext; backend encrypts; None = keep existing
    smtp_from: str | None = None


class EmailConfigResponse(BaseModel):
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password_set: bool = False
    smtp_from: str | None = None


DATE_FORMATS = ("dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd")
CURRENCIES = ("EUR", "USD", "GBP", "CHF", "JPY", "CAD", "AUD", "SEK", "DKK", "NOK")
DEFAULT_LOCATIONS = ["Remote"]


class PreferencesUpdate(BaseModel):
    """Organisation-wide display preferences. Omitted fields are left unchanged."""
    date_format: str | None = None
    currency: str | None = None
    locations: list[str] | None = Field(None, max_length=100)


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
    primary_color: str | None = None
    background_color: str | None = None
    font_family: str | None = None
    logo_url: str | None = None


_HEX_COLOR = r"^#[0-9a-fA-F]{3,8}$"
_FONT_NAME = r"^[\w\s,'\"-]{1,100}$"
_MAX_LOGO_CHARS = 700_000          # ~500 KB image as a data URL


class BrandingUpdate(BaseModel):
    """Rendered on the public job portal, so every field is validated strictly."""
    primary_color: str | None = Field(None, pattern=_HEX_COLOR)
    background_color: str | None = Field(None, pattern=_HEX_COLOR)
    font_family: str | None = Field(None, pattern=_FONT_NAME)
    logo_url: str | None = Field(None, max_length=_MAX_LOGO_CHARS)

    @field_validator("logo_url")
    @classmethod
    def _logo_must_be_https_or_inline_image(cls, value: str | None) -> str | None:
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
    department: str | None = None
    description: str | None = None
    headcount: int = 1


class RoleUpdate(BaseModel):
    name: str | None = None
    department: str | None = None
    description: str | None = None
    headcount: int | None = None


# ── Job Descriptions ────────────────────────────────────────────────────────────

class JobDescriptionCreate(BaseModel):
    role_id: str
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


class JobDescriptionUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    requirements: str | None = None
    location: str | None = None
    status: str | None = None
    openings: int | None = None
    owner: str | None = None
    salary_min: int | None = None
    salary_max: int | None = None
    salary_currency: str | None = None


class ImproveJDRequest(BaseModel):
    text: str
    role_name: str = ""


# ── Employees ───────────────────────────────────────────────────────────────────

class EmployeeCreate(BaseModel):
    first_name: str
    last_name: str
    email: str | None = None
    role_id: str | None = None
    role_name: str | None = None
    department: str | None = None
    salary: float | None = None
    currency: str = "USD"
    hire_date: str | None = None
    location: str | None = None
    manager: str | None = None
    candidate_id: str | None = None


class EmployeeUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    role_id: str | None = None
    role_name: str | None = None
    department: str | None = None
    salary: float | None = None
    location: str | None = None
    manager: str | None = None
    hire_date: str | None = None


class EmployeeNotesUpdate(BaseModel):
    notes: str


class EmployeeReminderSet(BaseModel):
    note: str


# ── Public Job Portal ────────────────────────────────────────────────────────

class PublicJobItem(BaseModel):
    id: str
    title: str
    location: str | None = None
    description: str | None = None
    requirements: str | None = None
    openings: int
    salary_min: int | None = None
    salary_max: int | None = None
    salary_currency: str = "EUR"


class PublicJobListResponse(BaseModel):
    org_id: str
    org_name: str
    branding: dict | None = None
    jobs: list[PublicJobItem]


class PortalApplicationRequest(BaseModel):
    cv_text: str | None = None


class PortalApplicationResponse(BaseModel):
    ok: bool
    candidate_id: str


# ── Performance Reviews ──────────────────────────────────────────────────────────

class ImproveReviewTextRequest(BaseModel):
    text: str
    field: str = "manager_feedback"            # "manager_feedback" | "self_evaluation"


class PerformanceReviewCreate(BaseModel):
    period: str
    self_evaluation: str | None = None
    manager_feedback: str | None = None
    rating: str | None = None
    action_goals: str | None = None
    next_review_date: str | None = None


class PerformanceReviewUpdate(BaseModel):
    period: str | None = None
    self_evaluation: str | None = None
    manager_feedback: str | None = None
    rating: str | None = None
    action_goals: str | None = None
    next_review_date: str | None = None


# ── Video Interviews ─────────────────────────────────────────────────────────

class VideoInterviewCreate(BaseModel):
    candidate_id: str
    questions: list[str]


class CompleteResponseRequest(BaseModel):
    total_chunks: int
