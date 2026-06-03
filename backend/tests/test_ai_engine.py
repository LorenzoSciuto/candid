"""Tests for AIEngine retry/fallback logic and AIEngineFactory.from_session_with_fallbacks."""
import pytest
from unittest.mock import MagicMock, patch, call

from candid.services.ai_engine import AIEngine, AIEngineFactory


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_engine(provider="openai", model="gpt-4o", api_key="sk-test", fallbacks=None):
    return AIEngine(provider, model, api_key, fallbacks=fallbacks)


# ---------------------------------------------------------------------------
# _call: retry on primary provider
# ---------------------------------------------------------------------------

class TestAIEngineRetry:
    """Primary provider retried up to 3 times with exponential back-off."""

    def test_succeeds_on_first_attempt(self):
        engine = _make_engine()
        with patch.object(engine, "_call_provider", return_value='{"ok":1}') as mock_cp, \
             patch("candid.services.ai_engine.time.sleep") as mock_sleep:
            result = engine._call("prompt")
        assert result == '{"ok":1}'
        mock_cp.assert_called_once_with("openai", "gpt-4o", "sk-test", "prompt")
        mock_sleep.assert_not_called()

    def test_retries_twice_then_succeeds(self):
        engine = _make_engine()
        side_effects = [RuntimeError("err1"), RuntimeError("err2"), '{"ok":2}']
        with patch.object(engine, "_call_provider", side_effect=side_effects) as mock_cp, \
             patch("candid.services.ai_engine.time.sleep") as mock_sleep:
            result = engine._call("prompt")
        assert result == '{"ok":2}'
        assert mock_cp.call_count == 3
        # sleep after attempt 0 → 2**0=1 s, after attempt 1 → 2**1=2 s
        mock_sleep.assert_has_calls([call(1), call(2)])

    def test_sleep_not_called_after_last_primary_attempt(self):
        """After the 3rd (final) primary attempt we should NOT sleep."""
        engine = _make_engine(fallbacks=[("anthropic", "claude-3-5-haiku-20241022", "sk-anth")])
        side_effects = [RuntimeError("p1"), RuntimeError("p2"), RuntimeError("p3"), '{"fb":1}']
        with patch.object(engine, "_call_provider", side_effect=side_effects), \
             patch("candid.services.ai_engine.time.sleep") as mock_sleep:
            engine._call("prompt")
        # Only 2 sleeps: after attempt 0 and attempt 1
        assert mock_sleep.call_count == 2
        mock_sleep.assert_has_calls([call(1), call(2)])

    def test_exponential_backoff_values(self):
        """Verify sleep durations are 2**0=1 and 2**1=2."""
        engine = _make_engine()
        with patch.object(engine, "_call_provider", side_effect=[RuntimeError(), RuntimeError(), '{"x":1}']), \
             patch("candid.services.ai_engine.time.sleep") as mock_sleep:
            engine._call("p")
        assert mock_sleep.call_args_list == [call(1), call(2)]


# ---------------------------------------------------------------------------
# _call: fallback behaviour
# ---------------------------------------------------------------------------

class TestAIEngineFallback:
    """After 3 primary failures, each fallback is tried once (no retry)."""

    def test_falls_back_to_second_provider(self):
        engine = _make_engine(
            fallbacks=[("anthropic", "claude-3-5-haiku-20241022", "sk-anth")]
        )
        # Primary fails 3 times; fallback succeeds
        side_effects = [RuntimeError("p1"), RuntimeError("p2"), RuntimeError("p3"), '{"fb":1}']
        with patch.object(engine, "_call_provider", side_effect=side_effects) as mock_cp, \
             patch("candid.services.ai_engine.time.sleep"):
            result = engine._call("prompt")
        assert result == '{"fb":1}'
        # 4th call is the fallback
        assert mock_cp.call_args_list[3] == call("anthropic", "claude-3-5-haiku-20241022", "sk-anth", "prompt")

    def test_fallback_tried_only_once(self):
        """Fallback providers are not retried."""
        engine = _make_engine(
            fallbacks=[("groq", "llama3-8b-8192", "sk-groq")]
        )
        all_fail = [RuntimeError() for _ in range(4)]  # 3 primary + 1 fallback
        with patch.object(engine, "_call_provider", side_effect=all_fail) as mock_cp, \
             patch("candid.services.ai_engine.time.sleep"):
            with pytest.raises(RuntimeError, match="All AI providers failed"):
                engine._call("prompt")
        # 3 primary + 1 fallback = 4 total
        assert mock_cp.call_count == 4

    def test_raises_after_all_exhausted(self):
        engine = _make_engine(
            fallbacks=[
                ("anthropic", "claude-3-5-haiku-20241022", "sk-anth"),
                ("gemini", "gemini-2.0-flash", "sk-gem"),
            ]
        )
        with patch.object(engine, "_call_provider", side_effect=RuntimeError("boom")), \
             patch("candid.services.ai_engine.time.sleep"):
            with pytest.raises(RuntimeError, match="All AI providers failed.*boom"):
                engine._call("prompt")

    def test_no_fallbacks_raises_after_three_primary_failures(self):
        engine = _make_engine()  # no fallbacks
        with patch.object(engine, "_call_provider", side_effect=RuntimeError("nope")), \
             patch("candid.services.ai_engine.time.sleep"):
            with pytest.raises(RuntimeError, match="All AI providers failed.*nope"):
                engine._call("prompt")

    def test_second_fallback_used_when_first_fallback_fails(self):
        engine = _make_engine(
            fallbacks=[
                ("anthropic", "claude-3-5-haiku-20241022", "sk-anth"),
                ("gemini", "gemini-2.0-flash", "sk-gem"),
            ]
        )
        side_effects = [
            RuntimeError(), RuntimeError(), RuntimeError(),  # primary x3
            RuntimeError(),                                   # fallback 1 fails
            '{"ok":3}',                                       # fallback 2 succeeds
        ]
        with patch.object(engine, "_call_provider", side_effect=side_effects), \
             patch("candid.services.ai_engine.time.sleep"):
            result = engine._call("prompt")
        assert result == '{"ok":3}'


# ---------------------------------------------------------------------------
# AIEngineFactory.from_session_with_fallbacks
# ---------------------------------------------------------------------------

class TestAIEngineFactoryWithFallbacks:
    """Unit-test the factory method using mocked DB sessions."""

    def _make_factory(self):
        from cryptography.fernet import Fernet
        from candid.services.crypto import CryptoService
        key = Fernet.generate_key().decode()
        crypto = CryptoService(key)
        factory = AIEngineFactory(crypto)
        return factory, crypto

    def _mock_session(self, cfg, api_key_rows):
        """Build a minimal mock Session."""
        session = MagicMock()
        session.get.return_value = cfg
        session.exec.return_value.all.return_value = api_key_rows
        return session

    def _org_config(self, provider="openai", model="gpt-4o"):
        cfg = MagicMock()
        cfg.provider = provider
        cfg.model_name = model
        return cfg

    def _api_key_row(self, factory, crypto, provider, plaintext_key):
        row = MagicMock()
        row.provider = provider
        row.encrypted_key = crypto.encrypt(plaintext_key)
        return row

    def test_no_org_id_falls_back_to_env(self):
        factory, _ = self._make_factory()
        with patch.dict("os.environ", {"DEFAULT_PROVIDER": "groq", "GROQ_API_KEY": "env-groq", "DEFAULT_MODEL": "llama3-8b-8192"}):
            engine = factory.from_session_with_fallbacks(MagicMock(), org_id="")
        assert engine._provider == "groq"
        assert engine._api_key == "env-groq"
        assert engine._fallbacks == []

    def test_primary_with_no_fallback_keys(self):
        factory, crypto = self._make_factory()
        cfg = self._org_config("openai", "gpt-4o")
        openai_row = self._api_key_row(factory, crypto, "openai", "sk-openai")
        session = self._mock_session(cfg, [openai_row])

        engine = factory.from_session_with_fallbacks(session, "org-1")
        assert engine._provider == "openai"
        assert engine._api_key == "sk-openai"
        assert engine._fallbacks == []

    def test_fallbacks_populated_from_extra_keys(self):
        factory, crypto = self._make_factory()
        cfg = self._org_config("openai", "gpt-4o")
        openai_row = self._api_key_row(factory, crypto, "openai", "sk-openai")
        anth_row = self._api_key_row(factory, crypto, "anthropic", "sk-anth")
        groq_row = self._api_key_row(factory, crypto, "groq", "sk-groq")
        session = self._mock_session(cfg, [openai_row, anth_row, groq_row])

        engine = factory.from_session_with_fallbacks(session, "org-1")
        assert engine._provider == "openai"
        assert engine._api_key == "sk-openai"
        # Two fallbacks
        fb_providers = {fb[0] for fb in engine._fallbacks}
        assert fb_providers == {"anthropic", "groq"}
        fb_keys = {fb[2] for fb in engine._fallbacks}
        assert fb_keys == {"sk-anth", "sk-groq"}

    def test_fallback_models_use_defaults(self):
        from candid.services.ai_engine import _FALLBACK_MODELS
        factory, crypto = self._make_factory()
        cfg = self._org_config("openai", "gpt-4o")
        anth_row = self._api_key_row(factory, crypto, "anthropic", "sk-anth")
        session = self._mock_session(cfg, [anth_row])
        # Primary key is missing from DB rows — falls back to env
        with patch.dict("os.environ", {"OPENAI_API_KEY": "env-openai"}):
            engine = factory.from_session_with_fallbacks(session, "org-1")
        assert engine._fallbacks[0][1] == _FALLBACK_MODELS["anthropic"]

    def test_rows_with_no_encrypted_key_are_skipped(self):
        factory, crypto = self._make_factory()
        cfg = self._org_config("openai", "gpt-4o")
        openai_row = self._api_key_row(factory, crypto, "openai", "sk-openai")
        empty_row = MagicMock()
        empty_row.provider = "groq"
        empty_row.encrypted_key = None
        session = self._mock_session(cfg, [openai_row, empty_row])

        engine = factory.from_session_with_fallbacks(session, "org-1")
        assert engine._fallbacks == []

    def test_from_session_unchanged_no_fallbacks(self):
        """Existing from_session must return an engine with no fallbacks."""
        factory, crypto = self._make_factory()
        cfg = self._org_config("openai", "gpt-4o")
        openai_row = self._api_key_row(factory, crypto, "openai", "sk-openai")
        anth_row = self._api_key_row(factory, crypto, "anthropic", "sk-anth")
        session = MagicMock()
        session.get.return_value = cfg
        session.exec.return_value.first.return_value = openai_row

        engine = factory.from_session(session, "org-1")
        assert engine._fallbacks == []
