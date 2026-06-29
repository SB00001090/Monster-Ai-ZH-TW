"""IP ban list management."""
from __future__ import annotations

import json
import time
from dataclasses import dataclass
from pathlib import Path


@dataclass
class BanEntry:
    ip: str
    expires_at: float
    reason: str


class Blocker:
    def __init__(self, banlist_path: Path, default_duration_minutes: int = 60) -> None:
        self.path = banlist_path
        self.default_duration = default_duration_minutes * 60
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._bans: dict[str, BanEntry] = {}
        self._load()

    def _load(self) -> None:
        if not self.path.exists():
            return
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
            for ip, entry in data.items():
                self._bans[ip] = BanEntry(
                    ip=ip,
                    expires_at=entry["expires_at"],
                    reason=entry.get("reason", ""),
                )
        except (json.JSONDecodeError, KeyError):
            pass
        self._purge_expired()

    def _save(self) -> None:
        payload = {
            ip: {"expires_at": e.expires_at, "reason": e.reason}
            for ip, e in self._bans.items()
            if e.expires_at > time.time()
        }
        self.path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    def _purge_expired(self) -> None:
        now = time.time()
        expired = [ip for ip, e in self._bans.items() if e.expires_at <= now]
        for ip in expired:
            del self._bans[ip]

    def is_banned(self, ip: str) -> bool:
        self._purge_expired()
        return ip in self._bans

    def ban(self, ip: str, reason: str, duration_seconds: int | None = None) -> None:
        dur = duration_seconds or self.default_duration
        self._bans[ip] = BanEntry(ip=ip, expires_at=time.time() + dur, reason=reason)
        self._save()

    def list_bans(self) -> list[dict]:
        self._purge_expired()
        return [
            {"ip": e.ip, "reason": e.reason, "expires_at": e.expires_at}
            for e in self._bans.values()
        ]