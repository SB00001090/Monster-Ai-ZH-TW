"""Privacy-safe logging — feature hashes only, no raw message content."""
from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path


class PrivacySafeLogger:
    def __init__(self, log_path: Path, retention_hours: int = 72) -> None:
        self.log_path = log_path
        self.retention_hours = retention_hours
        self.log_path.parent.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def hash_content(content: str) -> str:
        return hashlib.sha256(content.encode()).hexdigest()[:32]

    @staticmethod
    def hash_url(url: str) -> str:
        return hashlib.sha256(url.lower().encode()).hexdigest()[:16]

    def record(
        self,
        *,
        guild_id: int,
        action: str,
        score: int,
        reasons: list[str],
        scam_type: str | None,
        content_hash: str,
        url_hashes: list[str],
    ) -> None:
        entry = {
            "ts": time.time(),
            "guild_id": guild_id,
            "action": action,
            "score": score,
            "reasons": reasons,
            "scam_type": scam_type,
            "content_hash": content_hash,
            "url_hashes": url_hashes,
        }
        with self.log_path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    def count_recent(self, guild_id: int | None = None, hours: int = 24) -> int:
        if not self.log_path.exists():
            return 0
        cutoff = time.time() - hours * 3600
        count = 0
        with self.log_path.open(encoding="utf-8") as f:
            for line in f:
                try:
                    entry = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if entry.get("ts", 0) < cutoff:
                    continue
                if guild_id is not None and entry.get("guild_id") != guild_id:
                    continue
                if entry.get("action") in ("blocked", "deleted"):
                    count += 1
        return count