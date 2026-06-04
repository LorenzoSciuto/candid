import json
import os
import time
from typing import Any, Optional

from sqlmodel import Session, select

from candid.models import OrgApiKey, OrgConfig
from candid.prompts import Prompts
from candid.services.crypto import CryptoService


class AIEngine:
    """Executes LLM prompts via a configured provider with retry and fallback."""

    _MAX_PRIMARY_ATTEMPTS: int = 3
    _JSON_SYSTEM_PROMPT: str = "You are a recruiting assistant. Always respond with valid JSON."

    def __init__(
        self,
        provider: str,
        model: str,
        api_key: str,
        fallbacks: Optional[list[tuple[str, str, str]]] = None,
    ) -> None:
        self._provider = provider
        self._model = model
        self._api_key = api_key
        self._fallbacks: list[tuple[str, str, str]] = fallbacks or []

    # ── Public API ─────────────────────────────────────────────────────────────

    def analyze_cv(
        self,
        cv_text: str,
        position_name: str = "",
        jd_text: Optional[str] = None,
        notes: Optional[str] = None,
        open_roles: Optional[list] = None,
    ) -> dict:
        prompt = self._build_cv_analysis_prompt(cv_text, position_name, jd_text, notes, open_roles)
        raw_result = self._parse_json(self._call(prompt))
        return self._extract_analysis_fields(raw_result)

    def parse_quick_add(self, raw_text: str) -> dict:
        prompt = Prompts.QUICK_PARSE.format(raw_text=raw_text)
        return self._parse_json(self._call(prompt))

    def process_transcript(self, raw_transcript: str, cv_context: Optional[str] = None) -> dict:
        cv_context_section = (
            f"\nCandidate CV (use for name/company/role corrections):\n{cv_context[:2000]}\n"
            if cv_context else ""
        )
        prompt = Prompts.TRANSCRIPT.format(
            raw_transcript=raw_transcript,
            cv_context_section=cv_context_section,
        )
        return self._parse_json(self._call(prompt))

    def summarize_interview(self, text: str) -> dict:
        prompt = Prompts.INTERVIEW_SUMMARY.format(text=text)
        return self._parse_json(self._call(prompt))

    def rewrite_text(self, text: str, instruction: str) -> str:
        prompt = Prompts.REWRITE_TEXT.format(text=text, instruction=instruction)
        parsed_result = self._parse_json(self._call(prompt))
        return parsed_result.get("result", text)

    def run_prompt(self, prompt: str, result_key: str = "result") -> str:
        raw_response = self._call(prompt)
        parsed_response = self._parse_json(raw_response)
        return parsed_response.get(result_key, "")

    def generate_rejection_email(
        self,
        candidate_name: str,
        job_title: str,
        weaknesses: list[str],
        additional_context: str = "",
    ) -> dict:
        prompt = self._build_rejection_prompt(candidate_name, job_title, weaknesses, additional_context)
        result = self._parse_json(self._call(prompt))
        return {"subject": result.get("subject", ""), "body": result.get("body", "")}

    def _build_rejection_prompt(
        self,
        candidate_name: str,
        job_title: str,
        weaknesses: list[str],
        additional_context: str,
    ) -> str:
        weaknesses_text = "; ".join(weaknesses) if weaknesses else "Not specified"
        return Prompts.REJECTION_EMAIL.format(
            candidate_name=candidate_name,
            job_title=job_title,
            weaknesses=weaknesses_text,
            additional_context=additional_context or "None",
        )

    def improve_role_description(self, desc_text: str, role_name: str = "") -> str:
        prompt = Prompts.IMPROVE_ROLE_DESC.format(
            desc_text=desc_text,
            role_name=role_name or "this role",
        )
        parsed_result = self._parse_json(self._call(prompt))
        return parsed_result.get("improved_text", desc_text)

    def improve_jd(self, jd_text: str, role_name: str = "") -> str:
        prompt = Prompts.IMPROVE_JD.format(jd_text=jd_text, role_name=role_name or "this role")
        parsed_result = self._parse_json(self._call(prompt))
        return parsed_result.get("improved_text", jd_text)

    # ── Prompt builders ────────────────────────────────────────────────────────

    def _build_cv_analysis_prompt(
        self,
        cv_text: str,
        position_name: str,
        jd_text: Optional[str],
        notes: Optional[str],
        open_roles: Optional[list],
    ) -> str:
        position_section = f" Target position: {position_name}." if position_name else ""
        jd_section = f"\nJob Description:\n{jd_text}\n" if jd_text else ""
        notes_section = f"\nRecruiter notes:\n{notes}\n" if notes else ""
        roles_section = self._build_open_roles_section(open_roles)
        return Prompts.CV_ANALYSIS.format(
            position_section=position_section,
            cv_text=cv_text,
            jd_section=jd_section,
            notes_section=notes_section,
            roles_section=roles_section,
        )

    @staticmethod
    def _build_open_roles_section(open_roles: Optional[list]) -> str:
        if not open_roles:
            return ""
        formatted_roles = "\n".join(
            f"[{open_role['id']}] {open_role['title']}: {(open_role.get('description') or '')[:200]}"
            for open_role in open_roles
        )
        return f"\nOpen positions to score against:\n{formatted_roles}\n"

    @staticmethod
    def _extract_analysis_fields(raw_result: dict) -> dict:
        return {
            "overview": raw_result.get("overview", ""),
            "strengths": raw_result.get("strengths", []),
            "weaknesses": raw_result.get("weaknesses", []),
            "questions": raw_result.get("deep_dive_questions", raw_result.get("questions", [])),
            "extracted": raw_result.get("extracted_info", raw_result.get("extracted", {})),
            "career_history": raw_result.get("career_history", []),
            "role_fits": raw_result.get("role_fits", []),
        }

    # ── Retry / fallback orchestration ────────────────────────────────────────

    def _call(self, prompt: str) -> str:
        """Invoke primary provider with exponential backoff, then each fallback once."""
        primary_result, last_exception = self._attempt_primary_with_backoff(prompt)
        if primary_result is not None:
            return primary_result
        fallback_result, last_exception = self._attempt_fallback_providers(prompt, last_exception)
        if fallback_result is not None:
            return fallback_result
        raise RuntimeError(f"All AI providers failed. Last error: {last_exception}")

    def _attempt_primary_with_backoff(self, prompt: str) -> tuple[Optional[str], Exception]:
        last_exception: Exception = RuntimeError("No providers configured")
        for attempt_index in range(self._MAX_PRIMARY_ATTEMPTS):
            try:
                return self._call_provider(self._provider, self._model, self._api_key, prompt), last_exception
            except Exception as exception:  # noqa: BLE001
                last_exception = exception
                if attempt_index < self._MAX_PRIMARY_ATTEMPTS - 1:
                    time.sleep(2 ** attempt_index)
        return None, last_exception

    def _attempt_fallback_providers(
        self, prompt: str, last_exception: Exception
    ) -> tuple[Optional[str], Exception]:
        for fallback_provider, fallback_model, fallback_api_key in self._fallbacks:
            try:
                return self._call_provider(fallback_provider, fallback_model, fallback_api_key, prompt), last_exception
            except Exception as exception:  # noqa: BLE001
                last_exception = exception
        return None, last_exception

    # ── Provider dispatch ──────────────────────────────────────────────────────

    def _call_provider(self, provider: str, model: str, api_key: str, prompt: str) -> str:
        if provider == "anthropic":
            return self._call_anthropic(prompt, model=model, api_key=api_key)
        if provider == "gemini":
            return self._call_gemini(prompt, model=model, api_key=api_key)
        if provider == "groq":
            return self._call_groq(prompt, model=model, api_key=api_key)
        return self._call_openai(prompt, model=model, api_key=api_key)

    def _call_openai(self, prompt: str, *, model: Optional[str] = None, api_key: Optional[str] = None) -> str:
        from openai import OpenAI
        openai_client = OpenAI(api_key=api_key or self._api_key)
        response = openai_client.chat.completions.create(
            model=model or self._model,
            messages=[
                {"role": "system", "content": self._JSON_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            max_tokens=1500,
        )
        return response.choices[0].message.content or ""

    def _call_groq(self, prompt: str, *, model: Optional[str] = None, api_key: Optional[str] = None) -> str:
        from groq import Groq
        groq_client = Groq(api_key=api_key or self._api_key)
        response = groq_client.chat.completions.create(
            model=model or self._model,
            messages=[
                {"role": "system", "content": self._JSON_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            max_tokens=1500,
        )
        return response.choices[0].message.content or ""

    def _call_gemini(self, prompt: str, *, model: Optional[str] = None, api_key: Optional[str] = None) -> str:
        from google import genai
        gemini_client = genai.Client(api_key=api_key or self._api_key)
        response = gemini_client.models.generate_content(model=model or self._model, contents=prompt)
        return response.text

    def _call_anthropic(self, prompt: str, *, model: Optional[str] = None, api_key: Optional[str] = None) -> str:
        import anthropic
        anthropic_client = anthropic.Anthropic(api_key=api_key or self._api_key)
        message = anthropic_client.messages.create(
            model=model or self._model,
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text

    @staticmethod
    def _parse_json(text: str) -> Any:
        cleaned_text = text.strip()
        if cleaned_text.startswith("```"):
            code_block_parts = cleaned_text.split("```")
            cleaned_text = code_block_parts[1]
            if cleaned_text.startswith("json"):
                cleaned_text = cleaned_text[4:]
        return json.loads(cleaned_text.strip())


class AIEngineFactory:
    """Creates AIEngine instances from database org configuration or environment."""

    _DEFAULT_PROVIDER_MODELS: dict[str, str] = {
        "openai": "gpt-4o",
        "anthropic": "claude-3-5-haiku-20241022",
        "gemini": "gemini-2.0-flash",
        "groq": "llama-3.1-8b-instant",
    }

    def __init__(self, crypto_service: CryptoService) -> None:
        self._crypto_service = crypto_service

    def from_session(self, session: Session, org_id: str = "") -> AIEngine:
        """Return an AIEngine for the org's primary provider (no fallbacks)."""
        if org_id:
            org_config = session.get(OrgConfig, org_id)
            if org_config:
                org_api_key_row = session.exec(
                    select(OrgApiKey).where(
                        OrgApiKey.org_id == org_id,
                        OrgApiKey.provider == org_config.provider,
                    )
                ).first()
                if org_api_key_row and org_api_key_row.encrypted_key:
                    decrypted_key = self._crypto_service.decrypt(org_api_key_row.encrypted_key)
                    return AIEngine(org_config.provider, org_config.model_name, decrypted_key)
                return self._create_engine_from_environment(org_config.provider, org_config.model_name)
        return self._create_engine_from_environment()

    def from_session_with_fallbacks(self, session: Session, org_id: str = "") -> AIEngine:
        """Return an AIEngine with the primary provider and all stored fallbacks."""
        if not org_id:
            return self._create_engine_from_environment()
        org_config = session.get(OrgConfig, org_id)
        if not org_config:
            return self._create_engine_from_environment()
        primary_api_key, fallback_providers = self._resolve_provider_keys(
            session, org_id, org_config.provider
        )
        if primary_api_key is None:
            return self._build_engine_with_env_primary(org_config, fallback_providers)
        return AIEngine(org_config.provider, org_config.model_name, primary_api_key, fallbacks=fallback_providers)

    def _resolve_provider_keys(
        self, session: Session, org_id: str, primary_provider: str
    ) -> tuple[Optional[str], list[tuple[str, str, str]]]:
        all_org_api_keys = session.exec(
            select(OrgApiKey).where(OrgApiKey.org_id == org_id)
        ).all()
        primary_api_key: Optional[str] = None
        fallback_providers: list[tuple[str, str, str]] = []
        for api_key_row in all_org_api_keys:
            if not api_key_row.encrypted_key:
                continue
            decrypted_api_key = self._crypto_service.decrypt(api_key_row.encrypted_key)
            if api_key_row.provider == primary_provider:
                primary_api_key = decrypted_api_key
            else:
                fallback_model = self._DEFAULT_PROVIDER_MODELS.get(api_key_row.provider, api_key_row.provider)
                fallback_providers.append((api_key_row.provider, fallback_model, decrypted_api_key))
        return primary_api_key, fallback_providers

    def _build_engine_with_env_primary(
        self,
        org_config: OrgConfig,
        fallback_providers: list[tuple[str, str, str]],
    ) -> AIEngine:
        env_engine = self._create_engine_from_environment(org_config.provider, org_config.model_name)
        return AIEngine(
            env_engine._provider,
            env_engine._model,
            env_engine._api_key,
            fallbacks=fallback_providers,
        )

    def _create_engine_from_environment(
        self, provider: Optional[str] = None, model: Optional[str] = None
    ) -> AIEngine:
        resolved_provider = provider or os.environ.get("DEFAULT_PROVIDER", "openai")
        resolved_model = model or os.environ.get("DEFAULT_MODEL", "gpt-4o")
        provider_to_api_key_map = {
            "openai": os.environ.get("OPENAI_API_KEY", ""),
            "anthropic": os.environ.get("ANTHROPIC_API_KEY", ""),
            "gemini": os.environ.get("GEMINI_API_KEY", ""),
            "groq": os.environ.get("GROQ_API_KEY", ""),
        }
        return AIEngine(resolved_provider, resolved_model, provider_to_api_key_map.get(resolved_provider, ""))
