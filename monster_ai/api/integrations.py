"""Make / Sentry / platform integration webhooks."""
from __future__ import annotations

import os
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from monster_ai.modules.integrations.sentry_orchestrator import SentryOrchestrator

router = APIRouter(prefix="/api/integrations", tags=["integrations"])


class MakeHookBody(BaseModel):
    event: str = "deploy"
    detail: str = ""


def _make_secret(request: Request) -> str:
    env = request.app.state.settings.integrations.make_webhook_secret_env
    return os.environ.get(env, "")


def _google_drive_configured() -> bool:
    return bool(
        (os.environ.get("GOOGLE_CLIENT_ID") or os.environ.get("VITE_GOOGLE_CLIENT_ID") or "").strip()
    )


def _supabase_configured() -> bool:
    url = (os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL") or "").strip()
    key = (
        os.environ.get("VITE_SUPABASE_ANON_KEY")
        or os.environ.get("SUPABASE_ANON_KEY")
        or os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY")
        or ""
    ).strip()
    return bool(url and key)


@router.get("/status")
async def integrations_status(request: Request) -> dict[str, Any]:
    settings = request.app.state.settings
    dify = getattr(request.app.state, "dify", None)
    learning = getattr(request.app.state, "learning", None)
    mini = getattr(request.app.state, "mini", None)

    dify_st: dict[str, Any] = {"enabled": False}
    if dify:
        dify_st = await dify.health()

    success: dict[str, Any] = {}
    if mini:
        success = mini.tracker.status()

    guardian_success: dict[str, Any] = {}
    guardian = getattr(request.app.state, "guardian", None)
    if guardian is not None:
        guardian_success = guardian.generation_success_status()

    curriculum: dict[str, Any] = {}
    if learning:
        curriculum = learning.curriculum_status()

    workflow_error_configured = bool(
        settings.dify.workflow_error_id or settings.dify.workflow_multimodal_id
    )
    sentry_hook_env = settings.integrations.sentry_webhook_secret_env

    return {
        "cloudflare_pages": "https://monster-ai.pages.dev",
        "dify": dify_st,
        "sentry_configured": bool(os.environ.get(settings.integrations.sentry_dsn_env)),
        "sentry_webhook_configured": bool(os.environ.get(sentry_hook_env)),
        "workflow_error_configured": workflow_error_configured,
        "make_secret_configured": bool(_make_secret(request)),
        "supabase_configured": _supabase_configured(),
        "google_drive_configured": _google_drive_configured(),
        "cloud_sync_backend": getattr(
            getattr(request.app.state.settings, "guardian", None),
            "cloud_sync_backend",
            "dual",
        ),
        "mini_success": success,
        "guardian_success": guardian_success,
        "curriculum": curriculum,
        "sentry_auto_patch": settings.integrations.sentry_auto_patch_enabled,
        "quality_threshold": settings.dify.min_quality_score,
    }


@router.post("/make/deploy-hook")
async def make_deploy_hook(body: MakeHookBody, request: Request) -> dict:
    secret = _make_secret(request)
    header = request.headers.get("x-make-secret", "")
    if secret and header != secret:
        raise HTTPException(403, "Invalid Make webhook secret")
    if body.event == "integrations_snapshot":
        snapshot = await integrations_status(request)
        return {"ok": True, "event": body.event, "snapshot": snapshot}
    return {"ok": True, "event": body.event, "detail": body.detail}


@router.post("/sentry/hook")
async def sentry_issue_hook(request: Request) -> dict[str, Any]:
    """Sentry Issue → Guardian errors/report → Dify workflow → optional auto-patch."""
    settings = request.app.state.settings
    orchestrator = SentryOrchestrator(settings.integrations)
    header = request.headers.get("x-sentry-hook-secret", "")
    if not orchestrator.verify_secret(header):
        raise HTTPException(403, "Invalid Sentry webhook secret")

    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(400, "Invalid JSON payload") from exc
    if not isinstance(payload, dict):
        raise HTTPException(400, "Expected JSON object")

    guardian = getattr(request.app.state, "guardian", None)
    if guardian is None or not guardian.settings.enabled:
        raise HTTPException(503, "Guardian Ai disabled")

    dify = getattr(request.app.state, "dify", None)
    code_repair = getattr(request.app.state, "code_repair", None)
    return await orchestrator.handle(
        payload,
        guardian_svc=guardian,
        dify_bridge=dify,
        code_repair=code_repair,
    )