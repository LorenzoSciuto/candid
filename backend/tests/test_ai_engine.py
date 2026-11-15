"""Tests for AIEngine retry/fallback logic and AIEngineFactory provider resolution."""
from unittest.mock import MagicMock, call, patch

import pytest

from candid.services.ai_engine import AIEngine, AIEngineFactory


class TestAIEngineRetry:
    """Primary provider is retried up to 3 times with exponential back-off."""

    @staticmethod
    def _create_engine() -> AIEngine:
        return AIEngine("openai", "gpt-4o", "sk-test")

    def test_call_should_return_result_when_primary_succeeds_on_first_attempt(self) -> None:
        engine = self._create_engine()
        with patch.object(engine, "_call_provider", return_value='{"ok":1}') as mock_call_provider, \
             patch("candid.services.ai_engine.time.sleep") as mock_time_sleep:
            result = engine._call("prompt")
        assert result == '{"ok":1}'
        mock_call_provider.assert_called_once_with("openai", "gpt-4o", "sk-test", "prompt")
        mock_time_sleep.assert_not_called()

    def test_call_should_return_result_when_primary_fails_twice_then_succeeds(self) -> None:
        engine = self._create_engine()
        side_effects = [RuntimeError("first-failure"), RuntimeError("second-failure"), '{"ok":2}']
        with patch.object(engine, "_call_provider", side_effect=side_effects) as mock_call_provider, \
             patch("candid.services.ai_engine.time.sleep") as mock_time_sleep:
            result = engine._call("prompt")
        assert result == '{"ok":2}'
        assert mock_call_provider.call_count == 3
        mock_time_sleep.assert_has_calls([call(1), call(2)])

    def test_call_should_not_sleep_after_last_primary_attempt_when_fallback_exists(self) -> None:
        engine = AIEngine(
            "openai", "gpt-4o", "sk-test",
            fallbacks=[("anthropic", "claude-haiku-5-5", "sk-anthropic")],
        )
        side_effects = [RuntimeError(), RuntimeError(), RuntimeError(), '{"fallback":1}']
        with patch.object(engine, "_call_provider", side_effect=side_effects), \
             patch("candid.services.ai_engine.time.sleep") as mock_time_sleep:
            engine._call("prompt")
        assert mock_time_sleep.call_count == 2
        mock_time_sleep.assert_has_calls([call(1), call(2)])

    def test_call_should_use_exponential_backoff_when_primary_fails(self) -> None:
        engine = self._create_engine()
        with patch.object(engine, "_call_provider", side_effect=[RuntimeError(), RuntimeError(), '{"x":1}']), \
             patch("candid.services.ai_engine.time.sleep") as mock_time_sleep:
            engine._call("prompt")
        assert mock_time_sleep.call_args_list == [call(1), call(2)]


class TestAIEngineFallback:
    """After 3 primary failures, each fallback is tried exactly once (no retry)."""

    @staticmethod
    def _create_engine_with_fallback(
        fallback_provider: str = "anthropic",
        fallback_model: str = "claude-haiku-5-5",
        fallback_api_key: str = "sk-anthropic",
    ) -> AIEngine:
        return AIEngine(
            "openai", "gpt-4o", "sk-test",
            fallbacks=[(fallback_provider, fallback_model, fallback_api_key)],
        )

    def test_call_should_use_fallback_when_primary_exhausted(self) -> None:
        engine = self._create_engine_with_fallback()
        side_effects = [RuntimeError("p1"), RuntimeError("p2"), RuntimeError("p3"), '{"fallback":1}']
        with patch.object(engine, "_call_provider", side_effect=side_effects) as mock_call_provider, \
             patch("candid.services.ai_engine.time.sleep"):
            result = engine._call("prompt")
        assert result == '{"fallback":1}'
        fourth_call = mock_call_provider.call_args_list[3]
        assert fourth_call == call("anthropic", "claude-haiku-5-5", "sk-anthropic", "prompt")

    def test_call_should_try_fallback_once_when_fallback_fails(self) -> None:
        engine = self._create_engine_with_fallback()
        all_fail_side_effects = [RuntimeError() for _ in range(4)]
        with patch.object(engine, "_call_provider", side_effect=all_fail_side_effects) as mock_call_provider, \
             patch("candid.services.ai_engine.time.sleep"):
            with pytest.raises(RuntimeError, match="All AI providers failed"):
                engine._call("prompt")
        assert mock_call_provider.call_count == 4

    def test_call_should_raise_runtime_error_when_all_providers_exhausted(self) -> None:
        engine = AIEngine(
            "openai", "gpt-4o", "sk-test",
            fallbacks=[
                ("anthropic", "claude-haiku-5-5", "sk-anthropic"),
                ("gemini", "gemini-2.0-flash", "sk-gemini"),
            ],
        )
        with patch.object(engine, "_call_provider", side_effect=RuntimeError("final-error")), \
             patch("candid.services.ai_engine.time.sleep"):
            with pytest.raises(RuntimeError, match="All AI providers failed.*final-error"):
                engine._call("prompt")

    def test_call_should_raise_after_three_primary_failures_when_no_fallbacks(self) -> None:
        engine = AIEngine("openai", "gpt-4o", "sk-test")
        with patch.object(engine, "_call_provider", side_effect=RuntimeError("no-fallback")), \
             patch("candid.services.ai_engine.time.sleep"):
            with pytest.raises(RuntimeError, match="All AI providers failed.*no-fallback"):
                engine._call("prompt")

    def test_call_should_use_second_fallback_when_first_fallback_fails(self) -> None:
        engine = AIEngine(
            "openai", "gpt-4o", "sk-test",
            fallbacks=[
                ("anthropic", "claude-haiku-5-5", "sk-anthropic"),
                ("gemini", "gemini-2.0-flash", "sk-gemini"),
            ],
        )
        side_effects = [
            RuntimeError(), RuntimeError(), RuntimeError(),
            RuntimeError(),
            '{"ok":3}',
        ]
        with patch.object(engine, "_call_provider", side_effect=side_effects), \
             patch("candid.services.ai_engine.time.sleep"):
            result = engine._call("prompt")
        assert result == '{"ok":3}'


class TestAIEngineFactoryProviderResolution:
    """AIEngineFactory resolves provider configuration from database or environment."""

    @staticmethod
    def _create_factory() -> tuple[AIEngineFactory, "CryptoService"]:  # noqa: F821
        from cryptography.fernet import Fernet

        from candid.services.crypto import CryptoService
        fernet_key = Fernet.generate_key().decode()
        crypto_service = CryptoService(fernet_key)
        engine_factory = AIEngineFactory(crypto_service)
        return engine_factory, crypto_service

    @staticmethod
    def _create_org_config_mock(provider: str = "openai", model: str = "gpt-4o") -> MagicMock:
        org_config_mock = MagicMock()
        org_config_mock.provider = provider
        org_config_mock.model_name = model
        return org_config_mock

    @staticmethod
    def _create_mock_session(org_config: MagicMock, api_key_rows: list) -> MagicMock:
        mock_session = MagicMock()
        mock_session.get.return_value = org_config
        mock_session.exec.return_value.all.return_value = api_key_rows
        return mock_session

    @staticmethod
    def _create_encrypted_api_key_row_mock(
        crypto_service: "CryptoService",  # noqa: F821
        provider: str,
        plaintext_api_key: str,
    ) -> MagicMock:
        api_key_row_mock = MagicMock()
        api_key_row_mock.provider = provider
        api_key_row_mock.encrypted_key = crypto_service.encrypt(plaintext_api_key)
        return api_key_row_mock

    def test_from_session_with_fallbacks_should_return_env_engine_when_org_id_is_empty(self) -> None:
        engine_factory, _ = self._create_factory()
        with patch.dict("os.environ", {"DEFAULT_PROVIDER": "groq", "GROQ_API_KEY": "env-groq-key", "DEFAULT_MODEL": "llama3-8b-8192", "ALLOW_SERVER_AI_KEYS": "true"}):
            engine = engine_factory.from_session_with_fallbacks(MagicMock(), org_id="")
        assert engine._provider == "groq"
        assert engine._api_key == "env-groq-key"
        assert engine._fallbacks == []

    def test_server_keys_should_be_ignored_when_not_explicitly_allowed(self) -> None:
        engine_factory, _ = self._create_factory()
        with patch.dict("os.environ", {"DEFAULT_PROVIDER": "groq", "GROQ_API_KEY": "env-groq-key"}, clear=False):
            import os
            os.environ.pop("ALLOW_SERVER_AI_KEYS", None)
            engine = engine_factory.from_session_with_fallbacks(MagicMock(), org_id="")
        assert engine._api_key == ""

    def test_from_session_with_fallbacks_should_have_no_fallbacks_when_only_primary_key_stored(self) -> None:
        engine_factory, crypto_service = self._create_factory()
        org_config = self._create_org_config_mock("openai", "gpt-4o")
        openai_key_row = self._create_encrypted_api_key_row_mock(crypto_service, "openai", "sk-openai")
        mock_session = self._create_mock_session(org_config, [openai_key_row])

        engine = engine_factory.from_session_with_fallbacks(mock_session, "org-001")
        assert engine._provider == "openai"
        assert engine._api_key == "sk-openai"
        assert engine._fallbacks == []

    def test_from_session_with_fallbacks_should_populate_fallbacks_when_multiple_keys_stored(self) -> None:
        engine_factory, crypto_service = self._create_factory()
        org_config = self._create_org_config_mock("openai", "gpt-4o")
        openai_key_row = self._create_encrypted_api_key_row_mock(crypto_service, "openai", "sk-openai")
        anthropic_key_row = self._create_encrypted_api_key_row_mock(crypto_service, "anthropic", "sk-anthropic")
        groq_key_row = self._create_encrypted_api_key_row_mock(crypto_service, "groq", "sk-groq")
        mock_session = self._create_mock_session(org_config, [openai_key_row, anthropic_key_row, groq_key_row])

        engine = engine_factory.from_session_with_fallbacks(mock_session, "org-001")
        assert engine._provider == "openai"
        assert engine._api_key == "sk-openai"
        fallback_provider_names = {fallback[0] for fallback in engine._fallbacks}
        fallback_api_keys = {fallback[2] for fallback in engine._fallbacks}
        assert fallback_provider_names == {"anthropic", "groq"}
        assert fallback_api_keys == {"sk-anthropic", "sk-groq"}

    def test_from_session_with_fallbacks_should_use_default_models_for_fallback_providers(self) -> None:
        engine_factory, crypto_service = self._create_factory()
        org_config = self._create_org_config_mock("openai", "gpt-4o")
        anthropic_key_row = self._create_encrypted_api_key_row_mock(crypto_service, "anthropic", "sk-anthropic")
        mock_session = self._create_mock_session(org_config, [anthropic_key_row])
        with patch.dict("os.environ", {"OPENAI_API_KEY": "env-openai-key"}):
            engine = engine_factory.from_session_with_fallbacks(mock_session, "org-001")
        expected_anthropic_model = AIEngineFactory._DEFAULT_PROVIDER_MODELS["anthropic"]
        assert engine._fallbacks[0][1] == expected_anthropic_model

    def test_from_session_with_fallbacks_should_skip_fallback_when_encrypted_key_is_empty(self) -> None:
        engine_factory, crypto_service = self._create_factory()
        org_config = self._create_org_config_mock("openai", "gpt-4o")
        openai_key_row = self._create_encrypted_api_key_row_mock(crypto_service, "openai", "sk-openai")
        empty_key_row = MagicMock()
        empty_key_row.provider = "groq"
        empty_key_row.encrypted_key = None
        mock_session = self._create_mock_session(org_config, [openai_key_row, empty_key_row])

        engine = engine_factory.from_session_with_fallbacks(mock_session, "org-001")
        assert engine._fallbacks == []

    def test_from_session_should_return_engine_with_no_fallbacks_always(self) -> None:
        """from_session must never attach fallbacks (backward-compatible behaviour)."""
        engine_factory, crypto_service = self._create_factory()
        org_config = self._create_org_config_mock("openai", "gpt-4o")
        openai_key_row = self._create_encrypted_api_key_row_mock(crypto_service, "openai", "sk-openai")
        mock_session = MagicMock()
        mock_session.get.return_value = org_config
        mock_session.exec.return_value.first.return_value = openai_key_row

        engine = engine_factory.from_session(mock_session, "org-001")
        assert engine._fallbacks == []
