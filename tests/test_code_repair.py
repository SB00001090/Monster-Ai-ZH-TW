from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

from monster_ai.config import RepairSettings
from monster_ai.core.code_repair_agent import CodeRepairAgent


@pytest.fixture
def repair_agent(tmp_path):
    settings = RepairSettings(
        code_repair_enabled=True,
        max_auto_repairs_per_hour=3,
        allowed_paths=["monster_ai/"],
        run_tests_after_fix=False,
        auto_git_commit=False,
    )
    repair = MagicMock()
    repair.generate = AsyncMock(return_value="no diff here")
    return CodeRepairAgent(settings, repair, tmp_path)


@pytest.mark.asyncio
async def test_disabled_returns_early(repair_agent):
    repair_agent.settings.code_repair_enabled = False
    result = await repair_agent.attempt_fix("Traceback...")
    assert result.success is False
    assert "disabled" in result.message


@pytest.mark.asyncio
async def test_no_diff_fails(repair_agent):
    result = await repair_agent.attempt_fix("Traceback...")
    assert result.success is False


def test_allowed_path_check(repair_agent):
    assert repair_agent._allowed_path(Path("monster_ai/foo.py")) is True
    assert repair_agent._allowed_path(Path("etc/passwd")) is False


def test_parse_diff_files(repair_agent):
    diff = """--- a/monster_ai/foo.py
+++ b/monster_ai/foo.py
@@ -1 +1 @@
-x
+y
"""
    files = repair_agent._parse_diff_files(diff)
    assert files == ["monster_ai/foo.py"]