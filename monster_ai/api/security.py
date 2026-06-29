"""Security alerts and firewall status API."""
from __future__ import annotations

from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect

router = APIRouter(prefix="/api/security", tags=["security"])


@router.get("/status")
async def firewall_status(request: Request) -> dict:
    fw = request.app.state.firewall
    wd = request.app.state.watchdog
    ml = request.app.state.monsterlock
    cg = getattr(request.app.state, "crimeguard", None)
    callg = getattr(request.app.state, "callguard", None)
    probe = getattr(request.app.state, "hardware_probe", None)
    return {
        "firewall": fw.to_dict(),
        "watchdog": wd.to_dict(),
        "monsterlock": ml.to_dict(),
        "crimeguard": cg.to_dict() if cg else {"enabled": False},
        "callguard": callg.to_dict() if callg else {"enabled": False},
        "hardware": probe.to_dict() if probe else {},
        "bans": fw.blocker.list_bans(),
    }


@router.get("/crimeguard")
async def crimeguard_status(request: Request) -> dict:
    cg = request.app.state.crimeguard
    return cg.to_dict()


@router.get("/crimeguard/events")
async def crimeguard_events(request: Request, limit: int = 40) -> dict:
    return {"events": request.app.state.crimeguard.recent_events(limit)}


@router.post("/crimeguard/lock")
async def crimeguard_manual_lock(request: Request, body: dict) -> dict:
    cg = request.app.state.crimeguard
    if not cg.state.enabled:
        from fastapi import HTTPException
        raise HTTPException(503, "CrimeGuard disabled")
    reason = str(body.get("reason", "manual_ui_lock"))
    locked = await cg.manual_lock(reason=reason)
    return {"ok": locked, "network_locked": cg.state.network_locked, "message": reason}


@router.post("/analyze-prompt")
async def analyze_prompt_preview(request: Request, body: dict) -> dict:
    cg = request.app.state.crimeguard
    text = str(body.get("message", ""))
    preview_only = bool(body.get("preview_only", True))
    if preview_only:
        return cg.preview_prompt(text).to_dict()
    result = await cg.analyze_prompt(text, source="chat_ui")
    return result.to_dict()


@router.post("/crimeguard/recover")
async def crimeguard_recover(request: Request, body: dict) -> dict:
    token = str(body.get("confirm_token", ""))
    ok, msg = request.app.state.crimeguard.emergency_unlock(token)
    if not ok:
        from fastapi import HTTPException
        raise HTTPException(403, msg)
    return {"ok": True, "message": msg}


@router.get("/monsterlock")
async def monsterlock_status(request: Request) -> dict:
    ml = request.app.state.monsterlock
    return ml.to_dict()


@router.get("/monsterlock/events")
async def monsterlock_events(request: Request, limit: int = 30) -> dict:
    ml = request.app.state.monsterlock
    return {"events": ml.recent_events(limit)}


@router.get("/alerts")
async def security_alerts(request: Request, limit: int = 20) -> dict:
    return {"alerts": request.app.state.firewall.hub.recent(limit)}


@router.websocket("/ws/alerts")
async def security_ws(websocket: WebSocket) -> None:
    notifier = websocket.app.state.firewall.webui
    await notifier.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        notifier.disconnect(websocket)