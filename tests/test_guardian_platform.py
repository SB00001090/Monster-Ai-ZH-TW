"""Guardian Ai platform tests."""
from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from monster_ai.app import create_app
from monster_ai.config import load_settings
from monster_ai.modules.guardian.crypto import (
    decrypt_payload,
    derive_oauth_key,
    encrypt_payload,
    oauth_user_hash,
)
from monster_ai.modules.guardian.disclaimer import DEVELOPER, get_disclaimer
from monster_ai.modules.guardian.oc_fingerprint import generate_fingerprint, verify_ownership


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


def test_disclaimer_hardcoded():
    zh = get_disclaimer("zh-TW")
    assert DEVELOPER in zh["text"]
    assert "無論任何原因均不接受退款" in zh["text"]
    assert "支持開發者" in zh["text"]
    assert "幼兒" in zh["text"]
    assert zh["version"] == "guardian_ai_v3"
    assert "幼兒" in zh.get("toddler_notice", "")
    assert "自主網絡學習" not in zh["text"]

    en = get_disclaimer("en")
    assert "toddler" in en["text"].lower()
    assert "No refunds will be accepted" in en["text"]
    assert en["version"] == "guardian_ai_v3"
    assert "Autonomous network learning" not in en["text"]


def test_e2e_encrypt_roundtrip():
    import base64
    import secrets

    from monster_ai.modules.guardian.crypto import SALT_SIZE

    salt = secrets.token_bytes(SALT_SIZE)
    key = derive_oauth_key("google", "sub-123", "test-passphrase-8", salt)
    payload = {"oc": [{"name": "Test OC"}]}
    blob = encrypt_payload(payload, key)
    blob.salt_b64 = base64.b64encode(salt).decode("ascii")
    out = decrypt_payload(blob, key)
    assert out == payload


def test_oauth_user_hash_stable():
    assert oauth_user_hash("github", "user-42") == oauth_user_hash("github", "user-42")


def test_oc_fingerprint_and_verify():
    card = {"name": "Luna", "description": "moon witch", "worldview": "fantasy"}
    record = generate_fingerprint(card, owner_id="user-1")
    assert record["watermark"].startswith("MGA-")
    assert verify_ownership(card, record, owner_id="user-1")


def test_guardian_status(client):
    r = client.get("/api/guardian/status")
    assert r.status_code == 200
    data = r.json()
    assert data["no_tailscale"] is True
    assert data["no_qr_code"] is True
    assert "Suckbob" in data["developer"]


def test_connection_endpoint(client):
    r = client.get("/api/guardian/connection")
    assert r.status_code == 200
    assert r.json()["mode"] == "cloudflare_tunnel"


def test_cloud_sync_upload_download(client):
    payload = {"characters": [{"id": "c1", "name": "Guardian OC"}]}
    up = client.post(
        "/api/guardian/sync/upload",
        json={
            "provider": "google",
            "provider_sub": "gid-999",
            "passphrase": "my-secret-key-12",
            "bundle_type": "oc_cards",
            "payload": payload,
        },
    )
    assert up.status_code == 200
    assert up.json()["ok"] is True

    down = client.post(
        "/api/guardian/sync/download",
        json={
            "provider": "google",
            "provider_sub": "gid-999",
            "passphrase": "my-secret-key-12",
            "bundle_type": "oc_cards",
        },
    )
    assert down.status_code == 200
    assert down.json()["payload"] == payload

    wrong = client.post(
        "/api/guardian/sync/download",
        json={
            "provider": "google",
            "provider_sub": "gid-999",
            "passphrase": "wrong-passphrase",
            "bundle_type": "oc_cards",
        },
    )
    assert wrong.json()["ok"] is False


def test_error_report_and_supervise(client):
    r = client.post(
        "/api/guardian/errors/report",
        json={
            "error_type": "TunnelError",
            "message": "tailscale connection refused",
            "context": "android tunnel",
        },
    )
    assert r.status_code == 200
    assert "fix_suggestion" in r.json()

    sup = client.post("/api/guardian/learning/supervise")
    assert sup.status_code == 200
    body = sup.json()
    assert body["supervisor"] == "grok"
    assert "priorities" in body


def test_quality_gate(client):
    assert client.post("/api/guardian/quality/gate", json={"score": 0.85}).json()["passed"]
    fail = client.post("/api/guardian/quality/gate", json={"score": 0.55}).json()
    assert fail["passed"] is False
    assert fail["action"] == "retry_generation"


def test_training_status(client):
    r = client.get("/api/guardian/training/status")
    assert r.status_code == 200
    data = r.json()
    assert data["training_encryption_enabled"] is True
    assert data["encrypted"] is True
    assert data["plaintext_forbidden"] is True
    assert data["vault"]["encrypted"] is True
    assert data["vault"]["plaintext_forbidden"] is True


def test_training_store_text(client):
    r = client.post(
        "/api/guardian/training/store-text",
        json={
            "label": "template",
            "name": "test_tpl",
            "content": "masterpiece, {{prompt}}",
        },
    )
    assert r.status_code == 200
    assert r.json()["encrypted"] is True


def test_oc_protect(client):
    r = client.post(
        "/api/guardian/oc/protect",
        json={"card": {"id": "x1", "name": "Nova", "description": "pilot"}},
    )
    assert r.status_code == 200
    assert r.json()["protected"] is True
    assert "extensions" in r.json()["card"]
    assert r.json()["fingerprint"]["watermark"].startswith("MGA-")


def test_oc_image_fingerprint_register_and_check(client):
    import base64
    import io

    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (64, 64), color=(120, 40, 200)).save(buf, format="PNG")
    image_b64 = base64.b64encode(buf.getvalue()).decode("ascii")

    reg = client.post(
        "/api/guardian/oc/image/register",
        json={"character_id": "c1", "owner_id": "user-a", "image_b64": image_b64},
    )
    assert reg.status_code == 200
    assert reg.json()["ok"] is True
    assert reg.json()["phash"]
    assert reg.json()["blocked"] is False

    check = client.post(
        "/api/guardian/oc/image/check",
        json={"owner_id": "user-b", "image_b64": image_b64},
    )
    assert check.status_code == 200
    assert check.json()["blocked"] is True
    assert check.json()["collision"]


def test_vector_memory_remember_recall(client):
    vault_key = "test-vault-key-8"
    remember = client.post(
        "/api/guardian/memory/hero-1/remember",
        json={"text": "喜歡在雨夜巡邏", "vault_key": vault_key, "role": "assistant"},
    )
    assert remember.status_code == 200
    assert remember.json()["ok"] is True
    assert remember.json()["memory_id"]

    recall = client.post(
        "/api/guardian/memory/hero-1/recall",
        json={"query": "雨夜", "vault_key": vault_key, "top_k": 3},
    )
    assert recall.status_code == 200
    assert recall.json()["ok"] is True
    assert recall.json()["memories"]
    assert "雨夜" in recall.json()["memories"][0]["text"]

    listed = client.post(
        "/api/guardian/memory/hero-1/list",
        json={"vault_key": vault_key, "limit": 10},
    )
    assert listed.status_code == 200
    assert listed.json()["total"] >= 1