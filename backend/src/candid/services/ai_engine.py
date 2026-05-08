import json
import os
from typing import Any, Optional

from sqlmodel import Session

from candid.models import Config
from candid.services.crypto import CryptoService


class _Prompts:
    CV_ANALYSIS = """\
Compare the Candidate CV against the Job Description for the position: {position_name}.

Return a JSON object with exactly these keys:
- "strengths": array of 3-5 strings — top technical/soft skill matches vs the JD
- "weaknesses": array of 2-4 strings — gaps, missing requirements, or risks to probe
- "deep_dive_questions": array of exactly 3 strings — strategic questions tailored to \
uncover actual expertise in critical areas
- "extracted_info": object with string fields first_name, last_name, email, role \
(null if not found in CV)

CV:
{cv_text}

Job Description:
{jd_text}

Return only valid JSON. No markdown fences. No explanation."""

    QUICK_PARSE = """\
Extract structured candidate information from the following raw text \
(notes, email, DM, etc.).

Return a JSON object with exactly these keys (null if not found):
- "first_name", "last_name" — strings
- "email" — string
- "phone" — string
- "current_role" — current job title and company as one string
- "years_of_experience" — integer estimate, or null
- "summary" — 1-2 sentence summary of key points

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


class AIEngine:
    def __init__(self, provider: str, model: str, api_key: str) -> None:
        self._provider = provider
        self._model = model
        self._api_key = api_key

    # ── Public API ─────────────────────────────────────────────────────────────

    def analyze_cv(self, cv_text: str, jd_text: str, position_name: str) -> dict:
        prompt = _Prompts.CV_ANALYSIS.format(
            position_name=position_name,
            cv_text=cv_text,
            jd_text=jd_text,
        )
        result = self._parse_json(self._call(prompt))
        return {
            "strengths": result.get("strengths", []),
            "weaknesses": result.get("weaknesses", []),
            "questions": result.get("deep_dive_questions", result.get("questions", [])),
            "extracted": result.get("extracted_info", result.get("extracted", {})),
        }

    def parse_quick_add(self, raw_text: str) -> dict:
        prompt = _Prompts.QUICK_PARSE.format(raw_text=raw_text)
        return self._parse_json(self._call(prompt))

    def process_transcript(self, raw_transcript: str) -> dict:
        prompt = _Prompts.TRANSCRIPT.format(raw_transcript=raw_transcript)
        return self._parse_json(self._call(prompt))

    def improve_jd(self, jd_text: str, role_name: str = "") -> str:
        prompt = _Prompts.IMPROVE_JD.format(jd_text=jd_text, role_name=role_name or "this role")
        result = self._parse_json(self._call(prompt))
        return result.get("improved_text", jd_text)

    # ── Private ────────────────────────────────────────────────────────────────

    def _call(self, prompt: str) -> str:
        if self._provider == "anthropic":
            return self._call_anthropic(prompt)
        if self._provider == "gemini":
            return self._call_gemini(prompt)
        if self._provider == "groq":
            return self._call_groq(prompt)
        return self._call_openai(prompt)

    def _call_openai(self, prompt: str) -> str:
        from openai import OpenAI

        client = OpenAI(api_key=self._api_key)
        response = client.chat.completions.create(
            model=self._model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=1500,
        )
        return response.choices[0].message.content or ""

    def _call_groq(self, prompt: str) -> str:
        from groq import Groq

        client = Groq(api_key=self._api_key)
        response = client.chat.completions.create(
            model=self._model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=1500,
        )
        return response.choices[0].message.content or ""

    def _call_gemini(self, prompt: str) -> str:
        import google.generativeai as genai

        genai.configure(api_key=self._api_key)
        model = genai.GenerativeModel(self._model)
        response = model.generate_content(prompt)
        return response.text

    def _call_anthropic(self, prompt: str) -> str:
        import anthropic

        client = anthropic.Anthropic(api_key=self._api_key)
        message = client.messages.create(
            model=self._model,
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text

    @staticmethod
    def _parse_json(text: str) -> Any:
        text = text.strip()
        if text.startswith("```"):
            parts = text.split("```")
            text = parts[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text.strip())


class AIEngineFactory:
    """Builds an AIEngine from the current database Config row."""

    def __init__(self, crypto: CryptoService) -> None:
        self._crypto = crypto

    def from_session(self, session: Session) -> AIEngine:
        from candid.models import ApiKey

        cfg: Optional[Config] = session.get(Config, 1)
        if not cfg:
            return self._from_env()

        provider = cfg.provider
        model = cfg.model_name

        # Try ApiKey table first (new multi-key storage)
        api_key_row: Optional[ApiKey] = session.get(ApiKey, provider)
        if api_key_row and api_key_row.encrypted_key:
            api_key = self._crypto.decrypt(api_key_row.encrypted_key)
            return AIEngine(provider, model, api_key)

        # Fall back to legacy single-key in Config
        if cfg.encrypted_api_key:
            api_key = self._crypto.decrypt(cfg.encrypted_api_key)
            return AIEngine(provider, model, api_key)

        return self._from_env(provider, model)

    def _from_env(self, provider: Optional[str] = None, model: Optional[str] = None) -> AIEngine:
        provider = provider or os.environ.get("DEFAULT_PROVIDER", "openai")
        model = model or os.environ.get("DEFAULT_MODEL", "gpt-4o")
        key_map = {
            "openai": os.environ.get("OPENAI_API_KEY", ""),
            "anthropic": os.environ.get("ANTHROPIC_API_KEY", ""),
            "gemini": os.environ.get("GEMINI_API_KEY", ""),
            "groq": os.environ.get("GROQ_API_KEY", ""),
        }
        api_key = key_map.get(provider) or ""
        return AIEngine(provider, model, api_key)
