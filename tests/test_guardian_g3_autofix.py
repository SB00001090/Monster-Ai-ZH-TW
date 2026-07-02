"""G3 — autoFix dual-write fields + errors/recent API."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from monster_ai.app import create_app
from monster_ai.config import load_settings


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    (tmp_path / "data").mkdir()
    cfg = tmp_path / "config.yaml"
    cfg.write_text(
        "guardian:\n  enabled: true\n  data_dir: ./data/guardian\n",
        encoding="utf-8",
    )
    settings = load_settings(cfg)
    settings.protection.monsterlock.enabled = False
    settings.protection.monsterlock.self_destruct_enabled = False
    app = create_app(settings)
    with TestClient(app) as test_client:
        yield test_client


def test_errors_report_includes_autofix_metadata(client):
    r = client.post(
        "/api/guardian/errors/report",
        json={
            "error_type": "TestError",
            "message": "econnrefused on :7860",
            "context": "autoFixEngine",
            "source": "node",
            "auto_fix_action": "api_retry",
            "auto_fix_result": "Marked API degraded",
            "incident_id": 42,
            "jam_url": "https://jam.dev/c/demo",
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["auto_fix_action"] == "api_retry"
    assert body["fix_suggestion"]
    assert "econnrefused" in body["fix_suggestion"].lower() or "7860" in body["fix_suggestion"]


def test_errors_recent_lists_cases(client):
    client.post(
        "/api/guardian/errors/report",
        json={"error_type": "A", "message": "first"},
    )
    client.post(
        "/api/guardian/errors/report",
        json={"error_type": "B", "message": "second"},
    )
    r = client.get("/api/guardian/errors/recent?limit=5")
    assert r.status_code == 200
    cases = r.json()["cases"]
    assert len(cases) >= 2
    assert cases[-1]["error_type"] == "B"