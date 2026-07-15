"""Guardian self-healing firewall tests."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from monster_ai.app import create_app
from monster_ai.config import load_settings
from monster_ai.protection.firewall import FirewallEngine
from monster_ai.protection.quarantine import QuarantineZone
from monster_ai.protection.voice_harassment import VoiceHarassmentDetector
from monster_ai.protection.blocker import Blocker


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


def test_firewall_status_includes_quarantine(client):
    r = client.get("/api/guardian/firewall/status")
    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is True
    assert "quarantine" in data
    assert "voice_harassment" in data


def test_voice_cross_number_detection(tmp_path):
    base = tmp_path / "security"
    blocker = Blocker(base / "banlist.json")
    detector = VoiceHarassmentDetector(base / "voice", blocker)

    first = detector.register(phone_number="+85211111111", voice_hash="abcd1234efgh5678")
    assert first["cross_number_match"] is False

    second = detector.register(phone_number="+85299999999", voice_hash="abcd1234efgh5679")
    assert second["cross_number_match"] is True
    assert second["blocked"] is True


def test_quarantine_isolate_and_release(tmp_path):
    qz = QuarantineZone(tmp_path / "quarantine")
    entry = qz.isolate(
        ip="10.0.0.5",
        path="/api/test",
        reasons=["injection_pattern"],
        score=90,
    )
    assert entry["id"]
    released = qz.release(entry["id"])
    assert released["ok"] is True


@pytest.mark.asyncio
async def test_firewall_block_populates_quarantine(tmp_path):
    settings = load_settings()
    settings.protection.firewall.enabled = True
    settings.protection.firewall.mode = "active"
    base = tmp_path / "logs" / "security"
    fw = FirewallEngine(settings.protection.firewall, settings.protection.notifications, base)
    allowed, reason = await fw.check_request(
        ip="203.0.113.9",
        path="/../../etc/passwd",
        method="GET",
        query="",
        body_preview="",
    )
    assert allowed is False
    assert reason == "blocked"
    assert fw.quarantine.status()["active_count"] >= 1