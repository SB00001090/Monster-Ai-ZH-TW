from monster_ai.config import Settings
from monster_ai.modules.roleplay.memory import MemoryManager


def test_trim_messages():
    settings = Settings()
    settings.modules.roleplay.max_history = 3
    mm = MemoryManager(settings, repair=None)  # type: ignore[arg-type]
    msgs = [{"role": "user", "content": str(i)} for i in range(10)]
    trimmed = mm.trim_messages(msgs)
    assert len(trimmed) == 3
    assert trimmed[0]["content"] == "7"


def test_build_context_prompt():
    settings = Settings()
    mm = MemoryManager(settings, repair=None)  # type: ignore[arg-type]
    prompt = mm.build_context_prompt("Base", "Summary here", [{"role": "user", "content": "Hi"}])
    assert "Base" in prompt
    assert "Summary here" in prompt