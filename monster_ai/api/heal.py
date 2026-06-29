"""Self-heal orchestrator API (Phase A)."""
from __future__ import annotations

from fastapi import APIRouter, Request

router = APIRouter(prefix="/api/heal", tags=["heal"])


@router.get("/status")
async def heal_status(request: Request) -> dict:
    orch = getattr(request.app.state, "self_heal", None)
    learning = getattr(request.app.state, "learning", None)
    base = {
        "orchestrator": orch.to_dict() if orch else {"enabled": False},
        "learning": await learning.health() if learning else {"enabled": False},
    }
    discord = getattr(request.app.state, "discord", None)
    if discord:
        base["discord_guard"] = discord.guard_status()
    return base


@router.post("/trigger")
async def heal_trigger(request: Request) -> dict:
    orch = getattr(request.app.state, "self_heal", None)
    if not orch:
        return {"ok": False, "message": "orchestrator disabled"}
    result = await orch.run_cycle()
    return {"ok": True, **result}