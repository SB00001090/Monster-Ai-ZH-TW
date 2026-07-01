"""Tests for Guardian backstory generator."""
from __future__ import annotations

import pytest

from monster_ai.modules.guardian.backstory import BackstoryGenerator, BACKSTORY_SECTIONS
from monster_ai.modules.guardian.oc_fingerprint import OCFingerprintStore


@pytest.fixture
def generator(tmp_path):
    store = OCFingerprintStore(tmp_path)
    return BackstoryGenerator(store)


@pytest.mark.asyncio
async def test_backstory_structured_sections(generator):
    card = {
        "id": "hero-1",
        "name": "Mai",
        "personality": "冷靜、執著",
        "worldview": "賽博朋克香港",
        "description": "私家偵探",
    }
    result = await generator.generate(
        card=card,
        owner_id="user-a",
        ephemeral=True,
        check_plagiarism=True,
        repair=None,
        multimodal=True,
    )
    assert result["ok"] is True
    assert result["ephemeral"] is True
    assert result["prompt_discarded"] is True
    for key in BACKSTORY_SECTIONS:
        assert key in result["sections"]
    assert result["fingerprint"]
    assert result["watermark"].startswith("MGA-")


@pytest.mark.asyncio
async def test_backstory_blocks_duplicate_oc(generator):
    card = {
        "id": "oc-1",
        "name": "Twin",
        "personality": "mirror",
        "description": "test",
    }
    await generator.generate(card=card, owner_id="owner-1", repair=None)
    blocked = await generator.generate(card=card, owner_id="owner-2", repair=None)
    assert blocked["ok"] is False
    assert blocked["blocked"] is True