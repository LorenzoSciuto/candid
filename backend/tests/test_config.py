import os
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
        # No DB key + no env key → should fail gracefully with 400
        _empty = {"OPENAI_API_KEY": "", "ANTHROPIC_API_KEY": "", "GEMINI_API_KEY": "", "GROQ_API_KEY": ""}
        with mock.patch.dict(os.environ, _empty):
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


class TestDeleteKey:
    def test_delete_existing_key_returns_204(self, client: TestClient) -> None:
        client.put("/config/keys", json={"provider": "openai", "api_key": "sk-to-delete-key"})
        resp = client.delete("/config/keys/openai")
        assert resp.status_code == 204

    def test_deleted_key_shows_empty(self, client: TestClient) -> None:
        client.put("/config/keys", json={"provider": "openai", "api_key": "sk-temp-key-abc123"})
        client.delete("/config/keys/openai")
        keys = client.get("/config/keys").json()
        assert keys["openai"] == ""

    def test_delete_nonexistent_key_is_idempotent(self, client: TestClient) -> None:
        resp = client.delete("/config/keys/openai")
        assert resp.status_code == 204

    def test_delete_unknown_provider_returns_400(self, client: TestClient) -> None:
        resp = client.delete("/config/keys/fakeprovider")
        assert resp.status_code == 400


class TestPipelineStages:
    def test_returns_default_stages_when_none_saved(self, client: TestClient) -> None:
        resp = client.get("/config/stages")
        assert resp.status_code == 200
        stages = resp.json()
        assert isinstance(stages, list)
        assert len(stages) > 0
        assert all("id" in s and "label" in s and "dot" in s for s in stages)

    def test_save_and_retrieve_custom_stages(self, client: TestClient) -> None:
        custom = [
            {"id": "applied", "label": "Applied", "dot": "#6366f1"},
            {"id": "screen",  "label": "Screen",  "dot": "#3b82f6"},
            {"id": "offer",   "label": "Offer",   "dot": "#10b981"},
        ]
        resp = client.put("/config/stages", json={"stages": custom})
        assert resp.status_code == 200
        assert resp.json()["ok"] is True
        retrieved = client.get("/config/stages").json()
        assert len(retrieved) == 3
        assert retrieved[0]["id"] == "applied"
        assert retrieved[2]["label"] == "Offer"

    def test_stage_missing_id_returns_400(self, client: TestClient) -> None:
        resp = client.put("/config/stages", json={"stages": [{"label": "No ID", "dot": "#000"}]})
        assert resp.status_code == 400

    def test_stage_missing_label_returns_400(self, client: TestClient) -> None:
        resp = client.put("/config/stages", json={"stages": [{"id": "nolabel", "dot": "#000"}]})
        assert resp.status_code == 400

    def test_save_empty_stages_list(self, client: TestClient) -> None:
        resp = client.put("/config/stages", json={"stages": []})
        assert resp.status_code == 200
        assert client.get("/config/stages").json() == []


class TestOrgIsolation:
    """Verify that org_id scoping actually prevents cross-org data access."""

    def test_candidates_isolated_by_org(self, client: TestClient, db) -> None:
        from sqlmodel import Session

        from candid.commons.models import Candidate

        with Session(db._engine) as session:
            other_c = Candidate(org_id="org-other", first_name="Eve", last_name="Outsider")
            session.add(other_c)
            session.commit()
            other_id = other_c.id

        # test client uses org-test — should not see org-other candidate
        listed = client.get("/candidates/").json()
        assert not any(c["id"] == other_id for c in listed)

        # 404 when fetching by id
        resp = client.get(f"/candidates/{other_id}")
        assert resp.status_code == 404

    def test_stages_isolated_by_org(self, client: TestClient, db) -> None:
        import json

        from sqlmodel import Session

        from candid.commons.models import OrgConfig

        # Save stages for a different org directly
        with Session(db._engine) as session:
            cfg = OrgConfig(org_id="org-other", stages_json=json.dumps([
                {"id": "secret", "label": "Secret Stage", "dot": "#ff0000"}
            ]))
            session.add(cfg)
            session.commit()

        # test client org should still get its own (default) stages
        stages = client.get("/config/stages").json()
        assert not any(s["id"] == "secret" for s in stages)


class TestPreferences:
    def test_get_preferences_should_return_defaults_when_never_saved(self, client) -> None:
        assert client.get("/config/preferences").json() == {
            "date_format": "dd/MM/yyyy", "currency": "EUR", "locations": ["Remote"],
        }

    def test_save_preferences_should_update_only_given_fields(self, client) -> None:
        client.put("/config/preferences", json={"currency": "USD"})
        resp = client.put("/config/preferences", json={"locations": [" Berlin ", "Remote", "Berlin", ""]})
        assert resp.json() == {"date_format": "dd/MM/yyyy", "currency": "USD", "locations": ["Berlin", "Remote"]}

    def test_save_preferences_should_return_400_when_currency_unsupported(self, client) -> None:
        assert client.put("/config/preferences", json={"currency": "XXX"}).status_code == 400
