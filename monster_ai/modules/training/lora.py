"""LoRA training launcher stub."""
from __future__ import annotations

from typing import Any

from monster_ai.config import Settings


class TrainingService:
    name = "training"

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def health(self) -> dict[str, Any]:
        if not self.settings.modules.training.enabled:
            return {"enabled": False, "healthy": False, "message": "Module disabled"}
        return {
            "enabled": True,
            "healthy": False,
            "message": "Training environment not configured in MVP",
        }