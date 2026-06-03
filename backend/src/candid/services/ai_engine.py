import json
import os
import time
from typing import Any, Optional

from sqlmodel import Session, select

from candid.models import OrgApiKey, OrgConfig
from candid.prompts import Prompts
from candid.services.crypto import CryptoService

# Default model names used when falling back to a provider that has no
# explicit model configured for the org (we just need *something* valid).
_FALLBACK_MODELS: dict[str, str] = {
    "openai": "gpt-4o",
    "anthropic": "claude-3-5-haiku-20241022",
    "gemini": "gemini-2.0-flash",
    "groq": "llama3-8b-8192",
}


class AIEngine:
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
        # Each fallback is (provider, model, api_key)
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
        position_section = f" Target position: {position_name}." if position_name else ""
        jd_section = f"\nJob Description:\n{jd_text}\n" if jd_text else ""
        notes_section = f"\nRecruiter notes:\n{notes}\n" if notes else ""
        if open_roles:
            lines = "\n".join(
                f"[{r['id']}] {r['title']}: {(r.get('description') or '')[:200]}"
                for r in open_roles
            )
            roles_section = f"\nOpen positions to score against:\n{lines}\n"
        else:
            roles_section = ""
        prompt = Prompts.CV_ANALYSIS.format(
            position_section=position_section,
            cv_text=cv_text,
            jd_section=jd_section,
            notes_section=notes_section,
            roles_section=roles_section,
        )
        result = self._parse_json(self._call(prompt))
        return {
            "overview": result.get("overview", ""),
            "strengths": result.get("strengths", []),
            "weaknesses": result.get("weaknesses", []),
            "questions": result.get("deep_dive_questions", result.get("questions", [])),
            "extracted": result.get("extracted_info", result.get("extracted", {})),
            "career_history": result.get("career_history", []),
            "role_fits": result.get("role_fits", []),
        }

    def parse_quick_add(self, raw_text: str) -> dict:
        prompt = Prompts.QUICK_PARSE.format(raw_text=raw_text)
        return self._parse_json(self._call(prompt))

    def process_transcript(self, raw_transcript: str) -> dict:
        prompt = Prompts.TRANSCRIPT.format(raw_transcript=raw_transcript)
        return self._parse_json(self._call(prompt))

    def summarize_interview(self, text: str) -> dict:
        prompt = Prompts.INTERVIEW_SUMMARY.format(text=text)
        return self._parse_json(self._call(prompt))

    def rewrite_text(self, text: str, instruction: str) -> str:
        prompt = Prompts.REWRITE_TEXT.format(text=text, instruction=instruction)
        result = self._parse_json(self._call(prompt))
        return result.get("result", text)

    def run_prompt(self, prompt: str, result_key: str = "result") -> str:
        raw = self._call(prompt)
        parsed = self._parse_json(raw)
        return parsed.get(result_key, "")

    def improve_role_description(self, desc_text: str, role_name: str = "") -> str:
        prompt = Prompts.IMPROVE_ROLE_DESC.format(
            desc_text=desc_text,
            role_name=role_name or "this role",
        )
        result = self._parse_json(self._call(prompt))
        return result.get("improved_text", desc_text)

    def improve_jd(self, jd_text: str, role_name: str = "") -> str:
        prompt = Prompts.IMPROVE_JD.format(jd_text=jd_text, role_name=role_name or "this role")
        result = self._parse_json(self._call(prompt))
        return result.get("improved_text", jd_text)

    # ── Private ────────────────────────────────────────────────────────────────

    def _call(self, prompt: str) -> str:
        """Call the primary provider with up to 3 attempts (exponential backoff),
        then try each fallback provider once.  Raises RuntimeError if all fail."""
        last_exc: Exception = RuntimeError("No providers configured")

        # --- Primary: up to 3 attempts with exponential backoff ---
        for attempt in range(3):
            try:
                return self._call_provider(self._provider, self._model, self._api_key, prompt)
            except Exception as exc:  # noqa: BLE001
                last_exc = exc
                if attempt < 2:
                    time.sleep(2 ** attempt)

        # --- Fallbacks: one attempt each ---
        for fb_provider, fb_model, fb_key in self._fallbacks:
            try:
                return self._call_provider(fb_provider, fb_model, fb_key, prompt)
            except Exception as exc:  # noqa: BLE001
                last_exc = exc

        raise RuntimeError(f"All AI providers failed. Last error: {last_exc}")

    def _call_provider(self, provider: str, model: str, api_key: str, prompt: str) -> str:
        """Dispatch a single call to the named provider."""
        if provider == "anthropic":
            return self._call_anthropic(prompt, model=model, api_key=api_key)
        if provider == "gemini":
            return self._call_gemini(prompt, model=model, api_key=api_key)
        if provider == "groq":
            return self._call_groq(prompt, model=model, api_key=api_key)
        return self._call_openai(prompt, model=model, api_key=api_key)

    _JSON_SYSTEM = "You are a recruiting assistant. Always respond with valid JSON."

    def _call_openai(self, prompt: str, *, model: Optional[str] = None, api_key: Optional[str] = None) -> str:
        from openai import OpenAI
        client = OpenAI(api_key=api_key or self._api_key)
        response = client.chat.completions.create(
            model=model or self._model,
            messages=[
                {"role": "system", "content": self._JSON_SYSTEM},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            max_tokens=1500,
        )
        return response.choices[0].message.content or ""

    def _call_groq(self, prompt: str, *, model: Optional[str] = None, api_key: Optional[str] = None) -> str:
        from groq import Groq
        client = Groq(api_key=api_key or self._api_key)
        response = client.chat.completions.create(
            model=model or self._model,
            messages=[
                {"role": "system", "content": self._JSON_SYSTEM},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            max_tokens=1500,
        )
        return response.choices[0].message.content or ""

    def _call_gemini(self, prompt: str, *, model: Optional[str] = None, api_key: Optional[str] = None) -> str:
        from google import genai
        client = genai.Client(api_key=api_key or self._api_key)
        response = client.models.generate_content(model=model or self._model, contents=prompt)
        return response.text

    def _call_anthropic(self, prompt: str, *, model: Optional[str] = None, api_key: Optional[str] = None) -> str:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key or self._api_key)
        message = client.messages.create(
            model=model or self._model,
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
    def __init__(self, crypto: CryptoService) -> None:
        self._crypto = crypto

    def from_session(self, session: Session, org_id: str = "") -> AIEngine:
        """Return an AIEngine for the org's primary provider (no fallbacks)."""
        if org_id:
            cfg = session.get(OrgConfig, org_id)
            if cfg:
                provider, model = cfg.provider, cfg.model_name
                key_row = session.exec(
                    select(OrgApiKey).where(
                        OrgApiKey.org_id == org_id,
                        OrgApiKey.provider == provider,
                    )
                ).first()
                if key_row and key_row.encrypted_key:
                    return AIEngine(provider, model, self._crypto.decrypt(key_row.encrypted_key))
                return self._from_env(provider, model)
        return self._from_env()

    def from_session_with_fallbacks(self, session: Session, org_id: str = "") -> AIEngine:
        """Return an AIEngine configured with the primary provider and all other
        providers for which the org has API keys stored as fallbacks."""
        if not org_id:
            return self._from_env()

        cfg = session.get(OrgConfig, org_id)
        if not cfg:
            return self._from_env()

        primary_provider, primary_model = cfg.provider, cfg.model_name

        # Fetch all stored keys for this org in one query
        all_key_rows = session.exec(
            select(OrgApiKey).where(OrgApiKey.org_id == org_id)
        ).all()

        primary_key: Optional[str] = None
        fallbacks: list[tuple[str, str, str]] = []

        for row in all_key_rows:
            if not row.encrypted_key:
                continue
            decrypted = self._crypto.decrypt(row.encrypted_key)
            if row.provider == primary_provider:
                primary_key = decrypted
            else:
                fb_model = _FALLBACK_MODELS.get(row.provider, row.provider)
                fallbacks.append((row.provider, fb_model, decrypted))

        if primary_key is None:
            # Fall back to env for primary key, still attach DB fallbacks
            primary_engine = self._from_env(primary_provider, primary_model)
            return AIEngine(
                primary_engine._provider,
                primary_engine._model,
                primary_engine._api_key,
                fallbacks=fallbacks,
            )

        return AIEngine(primary_provider, primary_model, primary_key, fallbacks=fallbacks)

    def _from_env(self, provider: Optional[str] = None, model: Optional[str] = None) -> AIEngine:
        provider = provider or os.environ.get("DEFAULT_PROVIDER", "openai")
        model = model or os.environ.get("DEFAULT_MODEL", "gpt-4o")
        key_map = {
            "openai": os.environ.get("OPENAI_API_KEY", ""),
            "anthropic": os.environ.get("ANTHROPIC_API_KEY", ""),
            "gemini": os.environ.get("GEMINI_API_KEY", ""),
            "groq": os.environ.get("GROQ_API_KEY", ""),
        }
        return AIEngine(provider, model, key_map.get(provider, ""))
