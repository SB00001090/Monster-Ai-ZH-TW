"""Automated checks for deploy/guardian/LAUNCH_CHECKLIST.md core items."""
from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from monster_ai.app import create_app
from monster_ai.config import load_settings
from monster_ai.modules.guardian.disclaimer import get_disclaimer

REPO_ROOT = Path(__file__).resolve().parent.parent


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


def test_training_status_encrypted_flags(client):
    r = client.get("/api/guardian/training/status")
    assert r.status_code == 200
    data = r.json()
    assert data["encrypted"] is True
    assert data["plaintext_forbidden"] is True
    assert data["vault"]["encrypted"] is True


def test_guardian_status_no_tailscale_no_qr(client):
    r = client.get("/api/guardian/status")
    data = r.json()
    assert data["no_tailscale"] is True
    assert data["no_qr_code"] is True


def test_disclaimer_refund_clause_hardcoded():
    zh = get_disclaimer("zh-TW")
    assert "無論任何原因均不接受退款" in zh["text"]
    assert zh["version"] == "guardian_ai_v3"


def test_errors_report_returns_fix_fields(client):
    r = client.post(
        "/api/guardian/errors/report",
        json={"error_type": "Test", "message": "econnrefused :7860"},
    )
    body = r.json()
    assert body["fix_suggestion"]
    assert "code_snippet" in body


def test_supervise_returns_grok_priorities(client):
    client.post(
        "/api/guardian/errors/report",
        json={"error_type": "RepeatError", "message": "fail"},
    )
    sup = client.post("/api/guardian/learning/supervise")
    assert sup.status_code == 200
    body = sup.json()
    assert body["supervisor"] == "grok"
    assert "priorities" in body
    assert isinstance(body["priorities"], list)


def test_quality_gate_fails_below_threshold(client):
    fail = client.post("/api/guardian/quality/gate", json={"score": 0.55}).json()
    assert fail["passed"] is False
    assert fail["status"] == "fail"


def test_oc_protect_mga_watermark(client):
    r = client.post(
        "/api/guardian/oc/protect",
        json={"card": {"id": "oc1", "name": "Test", "description": "pilot"}},
    )
    assert r.json()["fingerprint"]["watermark"].startswith("MGA-")


def test_no_qrserver_in_source_tree():
    """LAUNCH_CHECKLIST: no qrserver in product source."""
    skip_dirs = {"node_modules", ".git", ".venv", "dist", "build", "__pycache__", "tests"}
    exts = {".py", ".ts", ".tsx", ".js", ".kt", ".html", ".css"}
    hits: list[str] = []
    for path in REPO_ROOT.rglob("*"):
        if not path.is_file():
            continue
        if path.parts[0] == "tests" if len(path.parts) else False:
            continue
        if any(part in skip_dirs for part in path.parts):
            continue
        if path.suffix.lower() not in exts:
            continue
        if path.name in {"strip_qrserver.py", "test_guardian_launch_checklist.py"}:
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        if "api.qrserver.com" in text.lower():
            hits.append(str(path.relative_to(REPO_ROOT)))
    assert not hits, f"qrserver references: {hits[:5]}"


def test_install_apk_script_exists():
    ps1 = REPO_ROOT / "scripts" / "guardian" / "install-apk-adb.ps1"
    bat = REPO_ROOT / "install-apk-adb.bat"
    assert ps1.is_file()
    assert bat.is_file()


def test_connection_policy_tunnel_only(client):
    r = client.get("/api/guardian/connection")
    data = r.json()
    assert data["no_tailscale"] is True
    assert data["no_qr_code"] is True
    assert data["mode"] == "cloudflare_tunnel"


def test_smoke_tunnel_script_exists():
    script = REPO_ROOT / "scripts" / "guardian" / "smoke_tunnel.py"
    assert script.is_file()


def test_play_store_listing_doc_exists():
    doc = REPO_ROOT / "deploy" / "guardian" / "PLAY_STORE_LISTING.md"
    assert doc.is_file()
    text = doc.read_text(encoding="utf-8")
    assert "MGA" in text
    assert "Guardian Ai" in text


def test_dify_guardian_workflow_export_exists():
    wf = REPO_ROOT / "deploy" / "dify" / "workflow_guardian.json"
    assert wf.is_file()
    data = json.loads(wf.read_text(encoding="utf-8"))
    assert data.get("name") == "GuardianAi_FullStack"
    assert "MONSTER_TUNNEL_URL" in (data.get("variables") or {})


def test_commercial_trial_start(client):
    r = client.post("/api/commercial/trial/start")
    assert r.status_code == 200
    assert "remaining_days" in r.json()


def test_run_dev_server_script_exists():
    script = REPO_ROOT / "scripts" / "guardian" / "run_dev_server.py"
    assert script.is_file()


def test_reseal_config_script_exists():
    script = REPO_ROOT / "scripts" / "guardian" / "reseal_config.py"
    assert script.is_file()


def test_tunnel_e2e_script_exists():
    script = REPO_ROOT / "scripts" / "guardian" / "tunnel_e2e.py"
    assert script.is_file()


def test_auto_start_scripts_exist():
    assert (REPO_ROOT / "scripts" / "guardian" / "auto_start.py").is_file()
    assert (REPO_ROOT / "scripts" / "guardian" / "auto_start.bat").is_file()
    assert (REPO_ROOT / "auto-guardian.bat").is_file()


def test_pin_and_restart_scripts_exist():
    assert (REPO_ROOT / "scripts" / "guardian" / "pin_protected_files.py").is_file()
    assert (REPO_ROOT / "scripts" / "guardian" / "restart_backend.py").is_file()


def test_privacy_policy_tunnel_no_tailscale():
    policy = REPO_ROOT / "apps" / "guardian-ai-android" / "PRIVACY_POLICY.md"
    text = policy.read_text(encoding="utf-8")
    assert "Cloudflare Tunnel" in text
    assert "Tailscale" in text
    assert "不使用 Tailscale" in text or "No Tailscale" in text


def test_age_verification_component_exists():
    comp = REPO_ROOT / "client" / "src" / "components" / "AgeVerification.tsx"
    text = comp.read_text(encoding="utf-8")
    assert "AgeVerification" in text
    assert "18" in text
    app = (REPO_ROOT / "client" / "src" / "App.tsx").read_text(encoding="utf-8")
    assert "AgeVerification" in app


def test_commercial_regional_pricing(client):
    hk = client.get("/api/commercial/pricing?region=HK").json()
    tw = client.get("/api/commercial/pricing?region=TW").json()
    us = client.get("/api/commercial/pricing?region=US").json()
    assert hk["currency"] == "HKD" and hk["lifetime"] == 388
    assert tw["currency"] == "TWD" and tw["lifetime"] == 999
    assert us["currency"] == "USD" and us["lifetime"] == 49


def test_disclaimer_hardcoded_not_empty(client):
    r = client.get("/api/guardian/disclaimer?locale=zh-TW")
    body = r.json()
    assert body["version"] == "guardian_ai_v3"
    assert "cannot" not in body  # no disable flag exposed
    assert len(body["text"]) > 100


def test_training_migrate_endpoint(client):
    r = client.post("/api/guardian/training/migrate")
    assert r.status_code == 200
    body = r.json()
    assert body.get("ok") is True
    assert "migrated" in body


def test_sync_training_vault_ciphertext_at_rest(client, tmp_path):
    secret = "ultra-secret-training-prompt-xyz"
    up = client.post(
        "/api/guardian/sync/upload",
        json={
            "provider": "github",
            "provider_sub": "vault-user-1",
            "passphrase": "e2e-sync-pass-12",
            "bundle_type": "training_vault",
            "payload": {"assets": [{"id": "a1", "prompt": secret}]},
        },
    )
    assert up.status_code == 200
    assert up.json()["ok"] is True
    cloud_root = tmp_path / "data" / "guardian" / "cloud"
    hits = list(cloud_root.rglob("training_vault.json"))
    assert hits, "training_vault bundle not written"
    raw = hits[0].read_text(encoding="utf-8")
    assert secret not in raw
    assert "ciphertext" in raw or "nonce_b64" in raw


def test_training_key_hardware_binding(tmp_path):
    from monster_ai.config import GuardianSettings
    from monster_ai.modules.guardian.key_manager import TrainingKeyManager

    settings = GuardianSettings(data_dir=str(tmp_path / "guardian"), bind_hardware_key=True)
    km = TrainingKeyManager(settings, tmp_path, hardware_fingerprint="hw-test-fp")
    a = km.derive_key("pass-a")
    km2 = TrainingKeyManager(settings, tmp_path, hardware_fingerprint="hw-other")
    b = km2.derive_key("pass-a")
    assert a != b


def test_android_training_vault_keystore():
    kt = (
        REPO_ROOT
        / "apps"
        / "guardian-ai-android"
        / "app"
        / "src"
        / "main"
        / "java"
        / "ai"
        / "guardian"
        / "app"
        / "security"
        / "TrainingVaultKeyManager.kt"
    )
    text = kt.read_text(encoding="utf-8")
    assert "EncryptedSharedPreferences" in text
    assert "MasterKey" in text
    assert "Guardian Ai" in text


def test_check_env_script_exists():
    assert (REPO_ROOT / "scripts" / "guardian" / "check_env.py").is_file()


def test_bootstrap_env_script_exists():
    assert (REPO_ROOT / "scripts" / "guardian" / "bootstrap_env.py").is_file()


def test_bootstrap_scaffolds_webhook_secrets(tmp_path, monkeypatch):
    import sys

    monkeypatch.chdir(tmp_path)
    data = tmp_path / "data" / "guardian-ai"
    data.mkdir(parents=True)
    tunnel = "https://test-tunnel.trycloudflare.com"
    (data / "tunnel_url.txt").write_text(tunnel + "\n", encoding="utf-8")

    import scripts.guardian.bootstrap_env as boot

    monkeypatch.setattr(boot, "ROOT", tmp_path)
    monkeypatch.setattr(boot, "TUNNEL_FILE", data / "tunnel_url.txt")
    monkeypatch.setattr(boot, "ENV_FILE", tmp_path / ".env")
    monkeypatch.setattr(boot, "REPORT_FILE", data / "env_bootstrap.json")
    monkeypatch.setattr(boot, "HOOKS_FILE", data / "integration_hooks.json")
    monkeypatch.setattr(sys, "argv", ["bootstrap_env.py", "--scaffold-secrets"])

    assert boot.main() == 0
    env_text = (tmp_path / ".env").read_text(encoding="utf-8")
    assert "MAKE_WEBHOOK_SECRET=" in env_text
    assert "SENTRY_WEBHOOK_SECRET=" in env_text
    hooks = json.loads((data / "integration_hooks.json").read_text(encoding="utf-8"))
    assert hooks["make_deploy_hook"]["url"].startswith(tunnel)


def test_build_apk_scripts_exist():
    assert (REPO_ROOT / "scripts" / "guardian" / "build_apk.ps1").is_file()
    assert (REPO_ROOT / "build-guardian-apk.bat").is_file()


def test_release_keystore_and_aab_scripts_exist():
    assert (REPO_ROOT / "scripts" / "guardian" / "gen_release_keystore.ps1").is_file()
    assert (REPO_ROOT / "gen-release-keystore.bat").is_file()
    assert (REPO_ROOT / "scripts" / "guardian" / "build_aab.ps1").is_file()
    assert (REPO_ROOT / "build-guardian-aab.bat").is_file()


def test_smoke_integrations_script_exists():
    assert (REPO_ROOT / "scripts" / "guardian" / "smoke_integrations.py").is_file()
    assert (REPO_ROOT / "scripts" / "guardian" / "env_loader.py").is_file()


def test_config_has_guardian_and_dify_sections():
    cfg = (REPO_ROOT / "config.yaml").read_text(encoding="utf-8")
    assert "guardian:" in cfg
    assert "dify:" in cfg
    assert "workflow_error_id" in cfg


def test_huggingface_deploy_exists():
    assert (REPO_ROOT / "deploy" / "huggingface" / "app.py").is_file()


def test_no_tailscale_connection_mode_in_android():
    """Product must not expose Tailscale as a live connection path."""
    mode_src = (
        REPO_ROOT
        / "apps"
        / "guardian-ai-android"
        / "app"
        / "src"
        / "main"
        / "java"
        / "ai"
        / "guardian"
        / "app"
        / "network"
        / "ConnectionMode.kt"
    ).read_text(encoding="utf-8")
    assert "TAILSCALE" not in mode_src
    mgr = (
        REPO_ROOT
        / "apps"
        / "guardian-ai-android"
        / "app"
        / "src"
        / "main"
        / "java"
        / "ai"
        / "guardian"
        / "app"
        / "network"
        / "ConnectionManager.kt"
    ).read_text(encoding="utf-8")
    assert "getString(\"tailscale" not in mgr
    assert "ConnectionMode.TAILSCALE" not in mgr


def test_android_tunnel_rejects_tailscale():
    test_file = (
        REPO_ROOT
        / "apps"
        / "guardian-ai-android"
        / "app"
        / "src"
        / "test"
        / "java"
        / "ai"
        / "guardian"
        / "app"
        / "TunnelConnectionTest.kt"
    )
    assert test_file.is_file()
    text = test_file.read_text(encoding="utf-8")
    assert "rejectsTailscale" in text
    assert "trycloudflare.com" in text
    src = (
        REPO_ROOT
        / "apps"
        / "guardian-ai-android"
        / "app"
        / "src"
        / "main"
        / "java"
        / "ai"
        / "guardian"
        / "app"
        / "network"
        / "TunnelConnection.kt"
    )
    assert "ts.net" in src.read_text(encoding="utf-8")