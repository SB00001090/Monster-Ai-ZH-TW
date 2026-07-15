"""Quarantine zone — isolate new threat patterns for self-healing rule generation."""
from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path
from typing import Any


def _hash_ip(ip: str) -> str:
    return hashlib.sha256(ip.encode()).hexdigest()[:16]


def _entry_id(ip: str, path: str, reasons: list[str], body_preview: str) -> str:
    blob = f"{ip}|{path}|{','.join(reasons)}|{body_preview[:256]}"
    return hashlib.sha256(blob.encode()).hexdigest()[:24]


class QuarantineZone:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)
        self.index_path = self.root / "index.jsonl"

    def isolate(
        self,
        *,
        ip: str,
        path: str,
        reasons: list[str],
        score: int,
        body_preview: str = "",
        action: str = "blocked",
    ) -> dict[str, Any]:
        entry_id = _entry_id(ip, path, reasons, body_preview)
        existing = self.get(entry_id)
        if existing and not existing.get("released"):
            existing["hits"] = int(existing.get("hits", 1)) + 1
            existing["last_seen"] = time.time()
            self._write_entry(existing)
            return existing

        entry: dict[str, Any] = {
            "id": entry_id,
            "ip_hash": _hash_ip(ip),
            "path": path[:512],
            "reasons": reasons,
            "score": score,
            "body_fingerprint": hashlib.sha256(body_preview[:512].encode()).hexdigest()[:32],
            "action": action,
            "hits": 1,
            "released": False,
            "created_at": time.time(),
            "last_seen": time.time(),
        }
        self._write_entry(entry)
        self._append_index(entry)
        return entry

    def _write_entry(self, entry: dict[str, Any]) -> None:
        path = self.root / f"{entry['id']}.json"
        path.write_text(json.dumps(entry, ensure_ascii=False, indent=2), encoding="utf-8")

    def _append_index(self, entry: dict[str, Any]) -> None:
        with self.index_path.open("a", encoding="utf-8") as f:
            f.write(
                json.dumps(
                    {
                        "id": entry["id"],
                        "reasons": entry["reasons"],
                        "score": entry["score"],
                        "released": False,
                        "created_at": entry["created_at"],
                    },
                    ensure_ascii=False,
                )
                + "\n"
            )

    def get(self, entry_id: str) -> dict[str, Any] | None:
        path = self.root / f"{entry_id}.json"
        if not path.is_file():
            return None
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            return data if isinstance(data, dict) else None
        except (json.JSONDecodeError, OSError):
            return None

    def list_active(self, limit: int = 50) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        for path in sorted(self.root.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                continue
            if not data.get("released"):
                out.append(data)
            if len(out) >= limit:
                break
        return out

    def release(self, entry_id: str) -> dict[str, Any]:
        entry = self.get(entry_id)
        if entry is None:
            return {"ok": False, "reason": "not_found"}
        entry["released"] = True
        entry["released_at"] = time.time()
        self._write_entry(entry)
        return {"ok": True, "id": entry_id}

    def status(self) -> dict[str, Any]:
        active = self.list_active(limit=1000)
        reason_counts: dict[str, int] = {}
        for item in active:
            for reason in item.get("reasons") or []:
                reason_counts[reason] = reason_counts.get(reason, 0) + 1
        return {
            "active_count": len(active),
            "reason_counts": reason_counts,
            "total_hits": sum(int(i.get("hits", 1)) for i in active),
        }