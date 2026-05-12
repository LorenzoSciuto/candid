import json
import os
from typing import Any, Optional

from sqlmodel import Session

from candid.models import Config
from candid.prompts import Prompts
from candid.services.crypto import CryptoService


class AIEngine:
    def __init__(self, provider: str, model: str, api_key: str) -> None:
        self._provider = provider
        self._model = model
        self._api_key = api_key

    # ── Public API ─────────────────────────────────────────────────────────────

    def analyze_cv(self, cv_text: str, position_name: str, jd_text: Optional[str] = None, notes: Optional[str] = None) -> dict:
        jd_section = f"\nJob Description:\n{jd_text}\n" if jd_text else ""
        notes_section = f"\nAdditional notes from recruiter:\n{notes}\n" if notes else ""
        prompt = Prompts.CV_ANALYSIS.format(
            position_name=position_name,
            cv_text=cv_text,
            jd_section=jd_section,
            notes_section=notes_section,
        )
        result = self._parse_json(self._call(prompt))
        return {
            "strengths": result.get("strengths", []),
            "weaknesses": result.get("weaknesses", []),
            "questions": result.get("deep_dive_questions", result.get("questions", [])),
            "extracted": result.get("extracted_info", result.get("extracted", {})),
        }

    def parse_quick_add(self, raw_text: str) -> dict:
        prompt = Prompts.QUICK_PARSE.format(raw_text=raw_text)
        return self._parse_json(self._call(prompt))

    def process_transcript(self, raw_transcript: str) -> dict:
        prompt = Prompts.TRANSCRIPT.format(raw_transcript=raw_transcript)
        return self._parse_json(self._call(prompt))

    def rewrite_text(self, text: str, instruction: str) -> str:
        """Generic rewrite — wraps text+instruction in REWRITE_TEXT envelope."""
        prompt = Prompts.REWRITE_TEXT.format(text=text, instruction=instruction)
        result = self._parse_json(self._call(prompt))
        return result.get("result", text)

    def run_prompt(self, prompt: str, result_key: str = "result") -> str:
        """Call LLM with a fully-rendered prompt; return parsed JSON[result_key]."""
        raw = self._call(prompt)
        parsed = self._parse_json(raw)
        return parsed.get(result_key, "")

    def improve_jd(self, jd_text: str, role_name: str = "") -> str:
        prompt = Prompts.IMPROVE_JD.format(jd_text=jd_text, role_name=role_name or "this role")
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
        from google import genai

        client = genai.Client(api_key=self._api_key)
        response = client.models.generate_content(model=self._model, contents=prompt)
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
