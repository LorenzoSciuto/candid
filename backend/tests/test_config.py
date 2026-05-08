from fastapi.testclient import TestClient


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
