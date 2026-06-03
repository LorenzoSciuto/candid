"""Centralised LLM prompt templates for Candid backend."""
from __future__ import annotations


class Prompts:
    CV_ANALYSIS = """\
You are a senior technical recruiter. Analyse the candidate CV.{position_section}

Return a JSON object with exactly these keys:
- "overview": string — 2-3 sentence narrative summary of the candidate profile
- "strengths": array of 3-5 strings — top technical and soft skill matches
- "weaknesses": array of 2-4 strings — gaps, missing skills, or risks to probe
- "deep_dive_questions": array of exactly 3 strings — tailored interview questions
- "career_history": array of objects in reverse chronological order, each: \
{{"title": string, "company": string, "period": string, "description": string (1 sentence)}}
- "extracted_info": object {{"first_name", "last_name", "email", "role"}} — null if not found
- "role_fits": array — one entry per open position listed below, each: \
{{"role_id": string, "title": string, "score": float 0-5 (fractions allowed), \
"reason": string (1 sentence)}}. Empty array if no open positions provided.

CV:
{cv_text}
{jd_section}{notes_section}{roles_section}
Return only valid JSON. No markdown fences. No explanation."""

    QUICK_PARSE = """\
Extract structured candidate information from the following raw text \
(notes, email, CV, DM, etc.).

Return a JSON object with exactly these keys (null if not found):
- "first_name", "last_name" — strings
- "email" — string
- "phone" — string
- "current_role" — current job title and company as one string
- "years_of_experience" — integer estimate, or null
- "location" — city / country, or null
- "source" — how this candidate was found (Referral, LinkedIn, Inbound, etc.), or null
- "summary" — 1-2 sentence summary of key signals and notable points

Text:
{raw_text}

Return only valid JSON. No markdown fences."""

    TRANSCRIPT = """\
Identify speakers 'Interviewer' and 'Candidate' in the following interview transcript.

Return a JSON object with exactly these keys:
- "cleaned_transcript" — full transcript with speaker labels, one turn per line as \
"[Speaker]: text"
- "summary" — 2-3 sentence summary of the key signals and candidate impressions
- "extra_info" — notable quotes or observations worth highlighting

Transcript:
{raw_transcript}

Return only valid JSON. No markdown fences."""

    REWRITE_TEXT = """\
You are a helpful assistant. Rewrite or improve the following text according to the instruction.

Instruction: {instruction}

Text:
{text}

Return a JSON object with exactly one key:
- "result" — the rewritten text as a plain string

Return only valid JSON. No markdown fences."""

    # ── Named email-rewrite actions ───────────────────────────────────────────

    REWRITE_EMAIL = """\
You are a professional recruiter. Rewrite the following email{to_clause}{subject_clause}. \
Make it warm, clear, and compelling. Keep it under 200 words. \
Do not include a subject line in the body.

Original:
{text}

Return a JSON object with exactly one key:
- "result" — the rewritten email as a plain string

Return only valid JSON. No markdown fences."""

    REWRITE_CANDIDATE_EMAIL = """\
You are a professional, empathetic recruiter. Rewrite the following email to {candidate_name} \
for the {role} position. Make it warm, clear, and compelling. Keep it under 180 words. \
Do not add a subject line. Preserve the core intent of the original message.

Original:
{text}

Return a JSON object with exactly one key:
- "result" — the rewritten email as a plain string

Return only valid JSON. No markdown fences."""

    @classmethod
    def render_action(cls, action: str, **kwargs: str) -> str:
        actions: dict[str, str] = {
            "rewrite_email": cls.REWRITE_EMAIL,
            "rewrite_candidate_email": cls.REWRITE_CANDIDATE_EMAIL,
        }
        template = actions.get(action)
        if template is None:
            raise ValueError(f"Unknown prompt action: {action!r}")
        return template.format_map(kwargs)

    IMPROVE_ROLE_DESC = """\
You are an expert copywriter specialising in organisational design. Write a concise, \
impersonal role description for the following role. Describe what the person in this role \
does, their responsibilities, and their place in the organisation. Use declarative, \
third-person language (e.g. "The {role_name} is responsible for…"). Do NOT write a job \
ad, do NOT include requirements, qualifications, or benefits. Keep it to 3-5 sentences or \
a short paragraph.

Role: {role_name}

Notes provided by the user:
{desc_text}

Return a JSON object with exactly one key:
- "improved_text" — the role description as a plain string

Return only valid JSON. No markdown fences."""

    IMPROVE_JD = """\
You are an expert technical recruiter and copywriter. Improve the following job description \
to be more compelling, clear, and structured. Keep the role name and core requirements intact \
but make the language engaging, remove jargon, add clear sections (About the Role, What You'll \
Do, What We're Looking For, Nice to Have), and ensure it would attract top candidates.

Role: {role_name}

Current JD:
{jd_text}

Return a JSON object with exactly one key:
- "improved_text" — the full improved job description as a plain string (no markdown headers, \
use plain section titles followed by newline)

Return only valid JSON. No markdown fences."""

    IMPROVE_PERFORMANCE_FEEDBACK = """\
You are an experienced HR professional and people manager. Rewrite the following raw manager \
notes into a structured, professional performance review feedback section. Keep all factual \
content, specific examples, and observations intact but improve clarity, structure, and tone. \
The result should be constructive, balanced, and suitable for a formal performance record.

Raw manager notes:
{raw_feedback}

Return a JSON object with exactly one key:
- "improved_feedback" — the rewritten feedback as a plain string (no markdown, use plain \
paragraph breaks)

Return only valid JSON. No markdown fences."""

    IMPROVE_SELF_EVALUATION = """\
You are an experienced HR professional. Rewrite the following raw self-evaluation notes into a \
structured, professional self-assessment section. Keep all factual content, achievements, and \
reflections intact but improve clarity, structure, and tone. The result should be honest, \
constructive, and suitable for a formal performance record.

Raw self-evaluation notes:
{raw_text}

Return a JSON object with exactly one key:
- "improved_text" — the rewritten self-evaluation as a plain string (no markdown, use plain \
paragraph breaks)

Return only valid JSON. No markdown fences."""

    IMPROVE_REVIEW_MANAGER_FEEDBACK = """\
You are an experienced HR professional and people manager. Rewrite the following raw manager \
feedback notes into a structured, professional performance review feedback section. Keep all \
factual content, specific examples, and observations intact but improve clarity, structure, and \
tone. The result should be constructive, balanced, and suitable for a formal performance record.

Raw manager feedback:
{raw_text}

Return a JSON object with exactly one key:
- "improved_text" — the rewritten feedback as a plain string (no markdown, use plain paragraph \
breaks)

Return only valid JSON. No markdown fences."""

    INTERVIEW_SUMMARY = """\
You are a professional recruiting analyst. Summarize the following interview transcript or notes \
into a clear, concise debrief.

Interview text:
{text}

Return a JSON object with exactly two keys:
- "bullets" — an array of 4-6 short, plain-English bullet points covering key observations, \
  strengths, concerns, and standout moments
- "summary" — a 3-5 sentence discursive paragraph giving a holistic view of the candidate \
  based on this interview (communication, depth, fit, next steps)

Return only valid JSON. No markdown fences."""
