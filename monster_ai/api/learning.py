"""Autonomous learning API (Phase C)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/learning", tags=["learning"])


class FeedbackRequest(BaseModel):
    user_id: str = "default"
    session_id: str = ""
    rating: int | None = Field(default=None, ge=1, le=5)
    thumbs: str | None = None
    comment: str = ""
    message: str = ""


@router.get("/status")
async def learning_status(request: Request) -> dict:
    engine = request.app.state.learning
    return await engine.health()


@router.post("/feedback")
async def post_feedback(body: FeedbackRequest, request: Request) -> dict:
    engine = request.app.state.learning
    if not engine.settings.enabled:
        raise HTTPException(503, "Learning module disabled")
    return engine.record_feedback(
        user_id=body.user_id,
        session_id=body.session_id,
        rating=body.rating,
        thumbs=body.thumbs,
        comment=body.comment,
        message=body.message,
    )


@router.get("/users/{user_id}/preferences")
async def get_user_preferences(user_id: str, request: Request) -> dict:
    engine = request.app.state.learning
    return engine.preferences.get(user_id)


@router.get("/characters/{character_id}/knowledge")
async def get_character_knowledge(character_id: str, request: Request) -> dict:
    engine = request.app.state.learning
    return engine.knowledge.get(character_id)