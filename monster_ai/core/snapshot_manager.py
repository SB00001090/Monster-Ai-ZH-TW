"""Git snapshots for auto code repair rollback.

Respects .gitignore and refuses to stage known secret paths so self-heal
never commits tokens, keystores, or local config.
"""
from __future__ import annotations

import logging
import subprocess
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

# Exact basenames that must never be staged by self-heal (not *.example).
SECRET_BASENAMES = frozenset(
    {
        ".env",
        ".env.local",
        ".env.development.local",
        ".env.test.local",
        ".env.production.local",
        "config.yaml",
        "discord.token.local",
        "keystore.properties",
        "credentials.json",
        "id_rsa",
        "id_ed25519",
        "sealed_entropy.bin",
    }
)
SECRET_SUFFIXES = (".jks", ".pem", ".p12", ".key")
SECRET_NAME_PREFIXES = (".env.",)  # .env.something but we allow *.example below


class SnapshotManager:
    def __init__(self, repo_root: Path) -> None:
        self.root = Path(repo_root)

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

    def current_branch(self) -> str:
        r = self._run("rev-parse", "--abbrev-ref", "HEAD", check=False)
        if r.returncode != 0:
            return ""
        return (r.stdout or "").strip()

    def create_repair_branch(self) -> str:
        if not self.is_git_repo():
            logger.warning("snapshot: not a git repo at %s", self.root)
            return ""
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        branch = f"repair/{stamp}"
        r = self._run("checkout", "-b", branch, check=False)
        if r.returncode != 0:
            logger.error(
                "snapshot: failed to create branch %s: %s",
                branch,
                (r.stderr or r.stdout or "").strip(),
            )
            return ""
        logger.info("snapshot: created repair branch %s", branch)
        return branch

    def create_snapshot_tag(self, prefix: str = "heal") -> str:
        """Lightweight annotated-style tag name for pre-repair markers."""
        if not self.is_git_repo():
            return ""
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        tag = f"snapshot/{prefix}-{stamp}"
        r = self._run("tag", tag, check=False)
        if r.returncode != 0:
            logger.warning(
                "snapshot: tag %s failed: %s",
                tag,
                (r.stderr or r.stdout or "").strip(),
            )
            return ""
        logger.info("snapshot: tagged %s", tag)
        return tag

    @staticmethod
    def _looks_secret(path: str) -> bool:
        lower = path.replace("\\", "/").lower()
        name = Path(lower).name
        # Allow public templates
        if name.endswith(".example") or name.endswith(".sample"):
            return False
        if name in SECRET_BASENAMES:
            return True
        if any(name.endswith(suf) for suf in SECRET_SUFFIXES):
            return True
        if name.startswith(SECRET_NAME_PREFIXES) and not name.endswith(".example"):
            return True
        # Path segment heuristics (real keystore dir, not example files)
        if "/keystore/" in f"/{lower}/" and name.endswith((".jks", ".properties")):
            return True
        if "service-account" in name:
            return True
        return False

    def _list_safe_paths(self) -> list[str]:
        """Paths git would stage via `add -u` / untracked, minus secrets."""
        r = self._run("status", "--porcelain", "-u", check=False)
        if r.returncode != 0:
            return []
        safe: list[str] = []
        for line in (r.stdout or "").splitlines():
            if len(line) < 4:
                continue
            # porcelain: XY PATH or XY ORIG -> PATH
            raw = line[3:].strip()
            if " -> " in raw:
                raw = raw.split(" -> ", 1)[1]
            path = raw.strip().strip('"')
            if not path or self._looks_secret(path):
                if path:
                    logger.warning("snapshot: skip secret path %s", path)
                continue
            safe.append(path)
        return safe

    def stage_safe(self) -> int:
        """Stage changed tracked + untracked files while respecting .gitignore.

        Uses path-by-path `git add --` so ignored secrets are never force-added.
        Returns number of paths attempted.
        """
        if not self.is_git_repo():
            return 0
        paths = self._list_safe_paths()
        if not paths:
            return 0
        # Batch to avoid command-line length limits on Windows.
        batch_size = 40
        staged = 0
        for i in range(0, len(paths), batch_size):
            batch = paths[i : i + batch_size]
            r = self._run("add", "--", *batch, check=False)
            if r.returncode != 0:
                logger.warning(
                    "snapshot: git add failed for batch: %s",
                    (r.stderr or r.stdout or "").strip(),
                )
            else:
                staged += len(batch)
        return staged

    def commit_all(self, message: str) -> bool:
        """Stage safe paths (not raw `git add -A`) and commit."""
        if not self.is_git_repo():
            return False
        self.create_snapshot_tag(prefix="pre-commit")
        staged = self.stage_safe()
        if staged == 0:
            # Fallback: update index for tracked files only (no untracked secrets).
            self._run("add", "-u", check=False)
        r = self._run("commit", "-m", message, check=False)
        if r.returncode != 0:
            logger.warning(
                "snapshot: commit failed: %s",
                (r.stderr or r.stdout or "").strip(),
            )
            return False
        logger.info("snapshot: committed %r", message[:80])
        return True

    def revert_last_commit(self) -> bool:
        if not self.is_git_repo():
            return False
        r = self._run("reset", "--hard", "HEAD~1", check=False)
        if r.returncode != 0:
            logger.error(
                "snapshot: revert failed: %s",
                (r.stderr or r.stdout or "").strip(),
            )
            return False
        logger.info("snapshot: reverted last commit on %s", self.current_branch())
        return True

    def checkout_branch(self, branch: str) -> bool:
        if not branch or not self.is_git_repo():
            return False
        r = self._run("checkout", branch, check=False)
        if r.returncode != 0:
            logger.error(
                "snapshot: checkout %s failed: %s",
                branch,
                (r.stderr or r.stdout or "").strip(),
            )
            return False
        return True

    def status_summary(self) -> dict[str, object]:
        return {
            "is_git_repo": self.is_git_repo(),
            "branch": self.current_branch(),
            "safe_pending": len(self._list_safe_paths()) if self.is_git_repo() else 0,
        }
