"""LLM-powered automatic code repair."""
from __future__ import annotations

import json
import logging
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any

from monster_ai.config import RepairSettings
from monster_ai.core.self_repair import SelfRepairEngine
from monster_ai.core.snapshot_manager import SnapshotManager

if TYPE_CHECKING:
    from monster_ai.modules.guardian.error_learning import ErrorLearningStore

logger = logging.getLogger(__name__)

REPAIR_SYSTEM = """You fix Python code errors for Guardian Ai. Output ONLY a unified diff patch.
Format:
```diff
--- a/path/to/file.py
+++ b/path/to/file.py
@@ ...
```
No explanation. Only modify files under monster_ai/ or scripts/. Max 5 files."""


@dataclass
class RepairResult:
    success: bool
    message: str
    branch: str = ""
    files_changed: list[str] | None = None


class CodeRepairAgent:
    def __init__(
        self,
        settings: RepairSettings,
        repair: SelfRepairEngine,
        repo_root: Path,
    ) -> None:
        self.settings = settings
        self.repair = repair
        self.snapshots = SnapshotManager(repo_root)
        self.root = repo_root
        self._repairs_this_hour = 0
        self._error_store: ErrorLearningStore | None = None

    def bind_error_store(self, store: Any) -> None:
        """Attach Guardian ErrorLearningStore for context-aware repairs (G3)."""
        self._error_store = store

    def _allowed_path(self, path: Path) -> bool:
        rel = str(path).replace("\\", "/")
        for allowed in self.settings.allowed_paths:
            if rel.startswith(allowed.rstrip("/")):
                return True
        return False

    def _parse_diff_files(self, diff: str) -> list[str]:
        files = []
        for line in diff.splitlines():
            if line.startswith("+++ b/"):
                files.append(line[6:].strip())
        return files[: self.settings.max_files_per_fix]

    def _apply_diff(self, diff: str) -> bool:
        patch_file = self.root / "data" / "tmp" / "_repair.patch"
        patch_file.parent.mkdir(parents=True, exist_ok=True)
        patch_file.write_text(diff, encoding="utf-8")
        r = subprocess.run(
            ["git", "apply", "--check", str(patch_file)],
            cwd=str(self.root),
            capture_output=True,
            text=True,
        )
        if r.returncode != 0:
            return False
        r2 = subprocess.run(
            ["git", "apply", str(patch_file)],
            cwd=str(self.root),
            capture_output=True,
            text=True,
        )
        return r2.returncode == 0

    def _run_pytest(self) -> bool:
        if not self.settings.run_tests_after_fix:
            return True
        venv_py = self.root / ".venv" / "Scripts" / "python.exe"
        if not venv_py.exists():
            venv_py = self.root / ".venv" / "bin" / "python"
        python = str(venv_py) if venv_py.exists() else sys.executable
        r = subprocess.run(
            [python, "-m", "pytest", "tests", "-q", "--tb=no"],
            cwd=str(self.root),
            capture_output=True,
            text=True,
        )
        return r.returncode == 0

    async def attempt_fix(self, error_text: str) -> RepairResult:
        if not self.settings.code_repair_enabled:
            return RepairResult(False, "code repair disabled")
        if self._repairs_this_hour >= self.settings.max_auto_repairs_per_hour:
            return RepairResult(False, "repair circuit breaker open")

        branch = self.snapshots.create_repair_branch()
        guardian_ctx = ""
        if self._error_store is not None:
            recent = self._error_store.recent(5)
            if recent:
                guardian_ctx = (
                    "Recent Guardian error cases (fix_suggestion may help):\n"
                    f"{json.dumps(recent, ensure_ascii=False)[:3000]}\n\n"
                )
        prompt = f"{guardian_ctx}Fix this error:\n\n{error_text[:4000]}"
        try:
            raw = await self.repair.generate(prompt, system=REPAIR_SYSTEM)
        except Exception as exc:  # noqa: BLE001
            return RepairResult(False, f"LLM repair failed: {exc}")

        m = re.search(r"```diff\n(.*?)```", raw, re.DOTALL)
        if not m:
            m = re.search(r"(--- a/.*)", raw, re.DOTALL)
        diff = m.group(1).strip() if m else raw
        files = self._parse_diff_files(diff)
        for f in files:
            if not self._allowed_path(Path(f)):
                return RepairResult(False, f"forbidden path in patch: {f}")

        if not self._apply_diff(diff):
            return RepairResult(False, "patch apply failed")

        if not self._run_pytest():
            if self.settings.rollback_on_test_fail:
                self.snapshots.revert_last_commit()
            return RepairResult(False, "pytest failed after patch; reverted")

        if self.settings.auto_git_commit:
            self.snapshots.commit_all(f"auto-repair: {error_text[:80]}")

        self._repairs_this_hour += 1
        return RepairResult(
            True,
            "patch applied",
            branch=branch,
            files_changed=files,
        )