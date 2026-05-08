from typing import Optional

from pydantic import BaseModel


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
    extra_information: Optional[str] = None


# ── Analysis ───────────────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    candidate_id: Optional[str] = None
    job_title: str
    job_description: str
    cv_text: str


class QuickAddRequest(BaseModel):
    text: str


# ── Interviews ──────────────────────────────────────────────────────────────────

class InterviewCreate(BaseModel):
    candidate_id: str
    type: str = "Manual Paste"
    title: Optional[str] = None
    interviewer: Optional[str] = None
    date: Optional[str] = None
    raw_content: Optional[str] = None


class InterviewUpdate(BaseModel):
    title: Optional[str] = None
    interviewer: Optional[str] = None
    date: Optional[str] = None
    duration: Optional[str] = None
    raw_content: Optional[str] = None
    cleaned_transcript: Optional[str] = None
    ai_summary: Optional[str] = None


class InterviewProcess(BaseModel):
    raw_content: str


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
    api_key: Optional[str] = None  # plaintext — backend encrypts before storing


class ApiKeyUpsert(BaseModel):
    provider: str   # openai | anthropic | gemini | groq
    api_key: str    # plaintext; backend encrypts


class GoogleAuthRequest(BaseModel):
    token: str      # Google ID token from GIS


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
    remote_ok: bool = False
    status: str = "Draft"
    openings: int = 1
    owner: Optional[str] = None


class JobDescriptionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[str] = None
    location: Optional[str] = None
    remote_ok: Optional[bool] = None
    status: Optional[str] = None
    openings: Optional[int] = None
    owner: Optional[str] = None


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
