import unittest.mock as mock

from fastapi.testclient import TestClient

from candid.services.ai_engine import AIEngine


class TestGetConfig:
    def test_returns_defaults_when_empty(self, client: TestClient) -> None:
        resp = client.get("/config")
        assert resp.status_code == 200
        data = resp.json()
        assert data["provider"] == "openai"
        assert data["model_name"] == "gpt-4o"
        assert data["api_key_masked"] == ""


class TestSaveConfig:
    def test_saves_provider_and_model(self, client: TestClient) -> None:
        resp = client.put("/config", json={
            "provider": "anthropic",
            "model_name": "claude-3-5-sonnet-20241022",
            "api_key": "sk-ant-test-key-1234567890",
        })
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    def test_saved_provider_reflected_in_get(self, client: TestClient) -> None:
        client.put("/config", json={"provider": "anthropic", "model_name": "claude-opus-4", "api_key": "sk-ant-x"})
        data = client.get("/config").json()
        assert data["provider"] == "anthropic"
        assert data["model_name"] == "claude-opus-4"

    def test_key_is_masked_in_get(self, client: TestClient) -> None:
        client.put("/config", json={
            "provider": "openai",
            "model_name": "gpt-4o",
            "api_key": "sk-realkey1234567890abcdef",
        })
        resp = client.get("/config")
        masked = resp.json()["api_key_masked"]
        assert "****" in masked
        assert "realkey" not in masked

    def test_masked_value_not_re_encrypted(self, client: TestClient) -> None:
        client.put("/config", json={
            "provider": "openai",
            "model_name": "gpt-4o",
            "api_key": "sk-original-key-xyz",
        })
        first_masked = client.get("/config").json()["api_key_masked"]

        # PUT with the masked value — should not overwrite stored key
        client.put("/config", json={
            "provider": "openai",
            "model_name": "gpt-4o-mini",
            "api_key": first_masked,
        })
        second_masked = client.get("/config").json()["api_key_masked"]
        assert second_masked == first_masked


class TestApiKeys:
    def test_get_keys_returns_all_providers(self, client: TestClient) -> None:
        resp = client.get("/config/keys")
        assert resp.status_code == 200
        data = resp.json()
        for provider in ("openai", "anthropic", "gemini", "groq"):
            assert provider in data

    def test_get_keys_empty_when_no_keys(self, client: TestClient) -> None:
        data = client.get("/config/keys").json()
        assert all(v == "" for v in data.values())

    def test_upsert_key_stores_and_masks(self, client: TestClient) -> None:
        resp = client.put("/config/keys", json={"provider": "openai", "api_key": "sk-test-abc1234567890xyz"})
        assert resp.status_code == 200
        assert resp.json()["ok"] is True
        keys = client.get("/config/keys").json()
        assert "****" in keys["openai"]
        assert "sk-test-abc1234567890xyz" not in keys["openai"]

    def test_upsert_key_overwrites_existing(self, client: TestClient) -> None:
        client.put("/config/keys", json={"provider": "openai", "api_key": "sk-first-key-abcdef"})
        client.put("/config/keys", json={"provider": "openai", "api_key": "sk-second-key-ghijkl"})
        keys = client.get("/config/keys").json()
        # Masked value shows end of second key
        assert keys["openai"].endswith("ijkl")

    def test_upsert_key_unknown_provider_returns_400(self, client: TestClient) -> None:
        resp = client.put("/config/keys", json={"provider": "fakeprovider", "api_key": "sk-xxx"})
        assert resp.status_code == 400

    def test_upsert_different_providers_independently(self, client: TestClient) -> None:
        client.put("/config/keys", json={"provider": "openai", "api_key": "sk-openai-key-12345678"})
        client.put("/config/keys", json={"provider": "anthropic", "api_key": "sk-ant-key-12345678"})
        keys = client.get("/config/keys").json()
        assert keys["openai"] != ""
        assert keys["anthropic"] != ""
        assert keys["openai"] != keys["anthropic"]


class TestConfigTest:
    def test_no_key_returns_400(self, client: TestClient) -> None:
        # No config / key stored → test endpoint should fail gracefully
        resp = client.post("/config/test")
        assert resp.status_code == 400

    def test_with_key_calls_ai_and_returns_ok(self, client: TestClient) -> None:
        client.put("/config", json={"provider": "openai", "model_name": "gpt-4o", "api_key": "sk-test-key-12345"})
        with mock.patch.object(AIEngine, "_call", return_value='{"test": "ok"}'):
            resp = client.post("/config/test")
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert data["provider"] == "openai"
