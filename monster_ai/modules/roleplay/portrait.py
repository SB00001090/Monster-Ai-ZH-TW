"""Build portrait prompts from character cards."""
from __future__ import annotations

from monster_ai.modules.roleplay.character_card import CharacterCard

PORTRAIT_SUFFIX = (
    "character design, single person, upper body, detailed face, "
    "studio lighting, plain background, masterpiece, best quality"
)


def build_portrait_prompt(
    card: CharacterCard | None,
    user_description: str | None = None,
) -> str:
    parts: list[str] = []
    if card:
        parts.append(f"portrait of {card.name}")
        if card.description:
            parts.append(card.description)
        if card.personality:
            parts.append(card.personality)
    if user_description:
        parts.append(user_description.strip())
    if not parts:
        parts.append("original character portrait")
    parts.append(PORTRAIT_SUFFIX)
    return ", ".join(p for p in parts if p)