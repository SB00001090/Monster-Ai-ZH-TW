"""User feedback collection (Phase C)."""
from __future__ import annotations

from typing import Any

from monster_ai.modules.learning.store import LearningStore


class FeedbackCollector:
    def __init__(self, store: LearningStore) -> None:
        self.store = store

    def record(
        self,
        *,
        user_id: str,
        session_id: str,
        rating: int | None = None,
        thumbs: str | None = None,
        comment: str = "",
        message_id: str | None = None,
        regenerate: bool = False,
        extra: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        record = {
            "user_id": user_id,
            "session_id": session_id,
            "rating": rating,
            "thumbs": thumbs,
            "comment": comment,
            "message_id": message_id,
            "regenerate": regenerate,
            **(extra or {}),
        }
        self.store.append_jsonl(self.store.feedback_log, record)
        return record