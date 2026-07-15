"""Guardian generation success tracker tests."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from monster_ai.app import create_app
from monster_ai.config import load_settings
from monster_ai.modules.guardian.success_tracker import GuardianSuccessTracker


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


def test_guardian_success_tracker_records_and_summarizes(tmp_path):
    tracker = GuardianSuccessTracker(tmp_path / "guardian")
    for _ in range(98):
        tracker.record(ok=True, backend="sdxl", quality_score=0.92, guardian_gate_passed=True)
    for _ in range(2):
        tracker.record(ok=False, backend="sdxl", quality_score=0.4, guardian_gate_passed=False)

    status = tracker.status()
    assert status["total_recorded"] == 100
    assert status["success_rate"] == 0.98
    assert status["on_track"] is True
    assert status["by_backend"]["sdxl"]["total"] == 100


def test_generation_success_api(client):
    r = client.get("/api/guardian/generation/success")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert "target_rate" in body
    assert body["target_rate"] == 0.98