"""Generation history API."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

router = APIRouter(prefix="/api/history", tags=["history"])


@router.get("")
async def list_history(
    request: Request,
    date: str | None = None,
    type: str | None = None,
    q: str | None = None,
    limit: int = 50,
) -> dict:
    history = request.app.state.history
    entries = history.list_entries(date=date, job_type=type, query=q, limit=limit)
    return {"entries": entries, "count": len(entries)}


@router.get("/{job_id}")
async def get_history_entry(job_id: str, request: Request) -> dict:
    entry = request.app.state.history.get_entry(job_id)
    if not entry:
        raise HTTPException(404, "History entry not found")
    return entry


@router.delete("/purge")
async def purge_history(request: Request, older_than_days: int | None = None) -> dict:
    history = request.app.state.history
    days = older_than_days or request.app.state.settings.history.retention_days
    removed = history.purge_older_than(days)
    return {"removed": removed, "older_than_days": days}