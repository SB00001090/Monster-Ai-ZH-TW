import pytest

from monster_ai.llm.fallback import FallbackLLM


@pytest.mark.asyncio
async def test_fallback_always_pings():
    llm = FallbackLLM()
    assert await llm.ping() is True


@pytest.mark.asyncio
async def test_fallback_greeting():
    llm = FallbackLLM()
    reply = await llm.generate("hello")
    assert "Fallback mode" in reply


@pytest.mark.asyncio
async def test_fallback_empty_message():
    llm = FallbackLLM()
    reply = await llm.generate("   ")
    assert "Monster AI" in reply