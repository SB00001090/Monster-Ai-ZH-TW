"""Sentry → Guardian → Dify orchestration tests."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from monster_ai.app import create_app
from monster_ai.config import IntegrationsSettings, load_settings
from monster_ai.modules.integrations.sentry_orchestrator import SentryOrchestrator


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr("monster_ai.env_file.load_dotenv", lambda *a, **k: 0)
    for key in ("MAKE_WEBHOOK_SECRET", "SENTRY_WEBHOOK_SECRET"):
        monkeypatch.delenv(key, raising=False)
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


@pytest.mark.asyncio
async def test_sentry_orchestrator_reports_to_guardian():
    guardian = MagicMock()
    guardian.report_error = AsyncMock(
        return_value={"ok": True, "fix_suggestion": "restart api", "error_type": "SentryIssue"}
    )
    dify = MagicMock()
    dify.run_error_workflow = AsyncMock(return_value={"ok": False, "reason": "dify_disabled"})
    code_repair = MagicMock()
    code_repair.attempt_fix = AsyncMock()

    settings = IntegrationsSettings(sentry_auto_patch_enabled=False)
    result = await SentryOrchestrator(settings).handle(
        {
            "action": "created",
            "data": {
                "issue": {
                    "id": "99",
                    "title": "TypeError in generate",
                    "culprit": "monster_ai/modules/image/comfyui.py",
                    "permalink": "https://sentry.io/issues/99",
                }
            },
        },
        guardian_svc=guardian,
        dify_bridge=dify,
        code_repair=code_repair,
    )

    assert result["ok"] is True
    assert result["issue"]["issue_id"] == "99"
    guardian.report_error.assert_awaited_once()
    dify.run_error_workflow.assert_awaited_once()
    code_repair.attempt_fix.assert_not_awaited()


def test_sentry_hook_endpoint(client):
    payload = {
        "action": "created",
        "data": {
            "issue": {
                "id": "12",
                "title": "Connection refused",
                "culprit": "api/generation.py",
            }
        },
    }
    r = client.post("/api/integrations/sentry/hook", json=payload)
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["guardian"]["ok"] is True
    assert body["guardian"]["fix_suggestion"]