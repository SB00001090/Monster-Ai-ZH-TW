"""Tests for roleplay portrait prompts."""
from __future__ import annotations

from monster_ai.modules.roleplay.character_card import CharacterCard
from monster_ai.modules.roleplay.portrait import build_portrait_prompt


def test_build_portrait_from_card() -> None:
    card = CharacterCard(
        name="Luna",
        description="silver hair, blue eyes",
        personality="calm and witty",
    )
    prompt = build_portrait_prompt(card, None)
    assert "Luna" in prompt
    assert "silver hair" in prompt
    assert "masterpiece" in prompt


def test_build_portrait_user_override() -> None:
    prompt = build_portrait_prompt(None, "red armor knight")
    assert "red armor knight" in prompt