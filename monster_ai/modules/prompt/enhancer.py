"""LLM-powered English prompt generation for image/video."""
from __future__ import annotations

import re

from monster_ai.config import Settings
from monster_ai.core.self_repair import SelfRepairEngine
from monster_ai.llm.prompt_templates import (
    SD_PROMPT_SYSTEM,
    SD_PROMPT_USER,
    VIDEO_PROMPT_SYSTEM,
    VIDEO_PROMPT_USER,
)
from monster_ai.modules.prompt.anti_collapse import build_negative, enhance_positive


def _clean_prompt(text: str) -> str:
    line = text.strip().split("\n")[0].strip()
    line = line.strip("\"'")
    line = re.sub(r"^(prompt|output)\s*:\s*", "", line, flags=re.I)
    return line[:500]


class PromptEnhancer:
    def __init__(self, settings: Settings, repair: SelfRepairEngine) -> None:
        self.settings = settings
        self.repair = repair

    async def for_image(self, user_input: str) -> str:
        if not self.settings.modules.prompt.enabled:
            return user_input
        if re.match(r"^[\x00-\x7F]+$", user_input) and len(user_input) > 20:
            return user_input
        raw = await self.repair.generate(
            SD_PROMPT_USER.format(input=user_input),
            system=SD_PROMPT_SYSTEM,
        )
        cleaned = _clean_prompt(raw) or user_input
        if self.settings.modules.image.quality.add_quality_tags:
            return enhance_positive(cleaned)
        return cleaned

    def default_negative(self, base: str | None = None) -> str:
        return build_negative(base)

    async def for_video(self, user_input: str) -> str:
        if not self.settings.modules.prompt.enabled:
            return user_input
        raw = await self.repair.generate(
            VIDEO_PROMPT_USER.format(input=user_input),
            system=VIDEO_PROMPT_SYSTEM,
        )
        return _clean_prompt(raw) or user_input