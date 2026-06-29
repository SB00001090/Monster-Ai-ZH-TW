"""Protection level presets."""
from __future__ import annotations

from monster_ai.config import GuardSettings

LEVELS: dict[str, dict[str, int | str]] = {
    "light": {"block_threshold": 90, "warn_threshold": 60, "ai_threshold": 50},
    "standard": {"block_threshold": 80, "warn_threshold": 50, "ai_threshold": 40},
    "strict": {"block_threshold": 70, "warn_threshold": 40, "ai_threshold": 30},
}


def apply_level(settings: GuardSettings) -> GuardSettings:
    preset = LEVELS.get(settings.protection_level, LEVELS["standard"])
    data = settings.model_dump()
    data.update({k: v for k, v in preset.items() if k in data})
    return GuardSettings.model_validate(data)