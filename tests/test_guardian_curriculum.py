"""Guardian Ai curriculum 72h + cybersec mode API tests."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from monster_ai.app import create_app
from monster_ai.config import load_settings
from monster_ai.modules.learning.curriculum import (
    build_curriculum,
    curriculum_modes_summary,
    topic_count,
)


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    (tmp_path / "data").mkdir()
    cfg = tmp_path / "config.yaml"
    cfg.write_text(
        "guardian:\n  enabled: true\n  data_dir: ./data/guardian\n"
        "learning:\n  curriculum_enabled: true\n  curriculum_extended_hours: 72\n",
        encoding="utf-8",
    )
    settings = load_settings(cfg)
    settings.protection.monsterlock.enabled = False
    settings.protection.monsterlock.self_destruct_enabled = False
    app = create_app(settings)
    with TestClient(app) as test_client:
        yield test_client


def test_extended_curriculum_has_guardian_cyber_topics():
    cyber_topics = {t.id for p in build_curriculum("cybersec") for t in p.topics}
    assert "cyber-guardian-ai" in cyber_topics
    assert "cyber-guardian-firewall" in cyber_topics
    assert "cyber-cloudflare-tunnel" in cyber_topics
    assert "cyber-callguard" not in cyber_topics
    assert topic_count("cybersec") >= 50
    assert topic_count("extended") > topic_count("base")


def test_phase6_uses_guardian_android_not_callguard():
    phase6 = build_curriculum("base")[-1]
    ids = {t.id for t in phase6.topics}
    assert "guardian-android" in ids
    assert "callguard" not in ids


def test_curriculum_modes_summary():
    modes = curriculum_modes_summary()
    ids = {m["id"] for m in modes}
    assert "extended" in ids
    assert "cybersec" in ids
    extended = next(m for m in modes if m["id"] == "extended")
    assert extended["topic_count"] == topic_count("extended")
    assert extended["duration_hours_default"] == 72.0


def test_guardian_status_includes_curriculum(client):
    r = client.get("/api/guardian/status")
    assert r.status_code == 200
    data = r.json()
    assert "curriculum" in data
    assert data["curriculum"]["extended_topic_count"] > 72
    assert data["curriculum"]["cybersec_topic_count"] >= 50
    assert any(m["id"] == "cybersec" for m in data["curriculum"]["modes"])


def test_guardian_curriculum_topics_cybersec(client):
    r = client.get("/api/guardian/learning/curriculum/topics?mode=cybersec")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["total_topics"] >= 50
    topic_ids = [t["id"] for p in body["phases"] for t in p["topics"]]
    assert "cyber-guardian-firewall" in topic_ids
    assert all(t["track"] == "cyber" for p in body["phases"] for t in p["topics"])


@pytest.mark.asyncio
async def test_guardian_curriculum_start_fast(client):
    r = client.post(
        "/api/guardian/learning/curriculum/start",
        json={"mode": "cybersec", "fast_mode": True, "resume": False, "duration_hours": 1},
    )
    assert r.status_code == 200
    assert r.json()["ok"] is True
    client.post("/api/guardian/learning/curriculum/stop")