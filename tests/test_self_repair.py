import pytest

from monster_ai.config import Settings
from monster_ai.core.self_repair import SelfRepairEngine


@pytest.mark.asyncio
async def test_generate_uses_fallback_when_primary_down():
    settings = Settings()
    engine = SelfRepairEngine(settings)
    engine.state.primary_ok = False

    reply = await engine.generate("hello there")
    assert engine.state.active_backend == "fallback"
    assert reply


@pytest.mark.asyncio
async def test_heal_once_marks_fallback_on_ping_failure(monkeypatch):
    settings = Settings()
    engine = SelfRepairEngine(settings)

    async def fail_ping():
        return False

    monkeypatch.setattr(engine.primary, "ping", fail_ping)
    await engine._heal_once()

    assert engine.state.primary_ok is False
    assert engine.state.active_backend == "fallback"