"""Git snapshots for auto code repair rollback."""
from __future__ import annotations

import logging
import subprocess
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)


class SnapshotManager:
    def __init__(self, repo_root: Path) -> None:
        self.root = repo_root

    def _run(self, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["git", *args],
            cwd=str(self.root),
            capture_output=True,
            text=True,
            check=check,
        )

    def is_git_repo(self) -> bool:
        r = self._run("rev-parse", "--is-inside-work-tree", check=False)
        return r.returncode == 0 and r.stdout.strip() == "true"

    def create_repair_branch(self) -> str:
        if not self.is_git_repo():
            return ""
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        branch = f"repair/{stamp}"
        self._run("checkout", "-b", branch, check=False)
        return branch

    def commit_all(self, message: str) -> bool:
        if not self.is_git_repo():
            return False
        self._run("add", "-A", check=False)
        r = self._run("commit", "-m", message, check=False)
        return r.returncode == 0

    def revert_last_commit(self) -> bool:
        if not self.is_git_repo():
            return False
        r = self._run("reset", "--hard", "HEAD~1", check=False)
        return r.returncode == 0

    def checkout_branch(self, branch: str) -> bool:
        if not branch or not self.is_git_repo():
            return False
        r = self._run("checkout", branch, check=False)
        return r.returncode == 0