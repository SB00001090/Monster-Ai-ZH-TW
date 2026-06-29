import pytest

from monster_ai.core.generation_repair import GenerationError, GenerationRepair


@pytest.mark.asyncio
async def test_retries_then_succeeds():
    repair = GenerationRepair(max_retries=2)
    calls = {"n": 0}

    async def flaky():
        calls["n"] += 1
        if calls["n"] < 2:
            raise RuntimeError("fail")
        return "ok"

    result = await repair.run("test", flaky, validate=lambda x: x == "ok")
    assert result == "ok"
    assert calls["n"] == 2


@pytest.mark.asyncio
async def test_raises_after_retries():
    repair = GenerationRepair(max_retries=1)

    async def always_fail():
        raise RuntimeError("nope")

    with pytest.raises(GenerationError):
        await repair.run("test", always_fail, validate=lambda _: True)