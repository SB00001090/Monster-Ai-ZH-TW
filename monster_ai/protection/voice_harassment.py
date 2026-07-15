"""Cross-number voice harassment detection via perceptual voice fingerprints."""
from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path
from typing import Any

from monster_ai.protection.blocker import Blocker

SIMILARITY_THRESHOLD = 0.85
PERMANENT_BAN_SECONDS = 30 * 24 * 3600


def _normalize_hash(voice_hash: str) -> str:
    return voice_hash.strip().lower().replace("-", "")


def _hamming_similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    length = min(len(a), len(b))
    if length == 0:
        return 0.0
    matches = sum(1 for i in range(length) if a[i] == b[i])
    return matches / max(len(a), len(b))


def _hash_number(number: str) -> str:
    return hashlib.sha256(number.encode()).hexdigest()[:16]


class VoiceHarassmentDetector:
    def __init__(self, data_dir: Path, blocker: Blocker) -> None:
        self.root = data_dir
        self.root.mkdir(parents=True, exist_ok=True)
        self.store_path = self.root / "voice_fingerprints.jsonl"
        self.blacklist_path = self.root / "voice_blacklist.json"
        self._blocker = blocker
        self._entries: list[dict[str, Any]] = []
        self._blacklist: set[str] = set()
        self._load()

    def _load(self) -> None:
        if self.store_path.is_file():
            for line in self.store_path.read_text(encoding="utf-8").splitlines():
                try:
                    row = json.loads(line)
                    if isinstance(row, dict):
                        self._entries.append(row)
                except json.JSONDecodeError:
                    continue
        if self.blacklist_path.is_file():
            try:
                data = json.loads(self.blacklist_path.read_text(encoding="utf-8"))
                voices = data.get("voice_ids") if isinstance(data, dict) else []
                if isinstance(voices, list):
                    self._blacklist = {str(v) for v in voices}
            except (json.JSONDecodeError, OSError):
                pass

    def _save_blacklist(self) -> None:
        self.blacklist_path.write_text(
            json.dumps({"voice_ids": sorted(self._blacklist), "updated_at": time.time()}, indent=2),
            encoding="utf-8",
        )

    def _append_entry(self, entry: dict[str, Any]) -> None:
        self._entries.append(entry)
        with self.store_path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    def _find_voice_id(self, voice_hash: str) -> str:
        normalized = _normalize_hash(voice_hash)
        for entry in self._entries:
            existing = _normalize_hash(str(entry.get("voice_hash", "")))
            if _hamming_similarity(normalized, existing) >= SIMILARITY_THRESHOLD:
                return str(entry.get("voice_id", existing[:16]))
        return normalized[:16]

    def register(
        self,
        *,
        phone_number: str,
        voice_hash: str,
        caller_label: str = "",
    ) -> dict[str, Any]:
        number_hash = _hash_number(phone_number)
        voice_id = self._find_voice_id(voice_hash)
        cross_match: dict[str, Any] | None = None

        for entry in self._entries:
            if entry.get("voice_id") != voice_id:
                continue
            if entry.get("number_hash") == number_hash:
                continue
            sim = _hamming_similarity(
                _normalize_hash(voice_hash),
                _normalize_hash(str(entry.get("voice_hash", ""))),
            )
            if sim >= SIMILARITY_THRESHOLD:
                cross_match = {
                    "voice_id": voice_id,
                    "similarity": round(sim, 4),
                    "prior_number_hash": entry.get("number_hash"),
                }
                break

        entry = {
            "voice_id": voice_id,
            "number_hash": number_hash,
            "voice_hash": _normalize_hash(voice_hash)[:64],
            "caller_label": caller_label[:64],
            "recorded_at": time.time(),
        }
        self._append_entry(entry)

        blocked = False
        if cross_match or voice_id in self._blacklist:
            self._blacklist.add(voice_id)
            self._save_blacklist()
            self._blocker.ban(
                f"voice:{voice_id}",
                "voice_harassment_cross_number",
                duration_seconds=PERMANENT_BAN_SECONDS,
            )
            blocked = True

        return {
            "ok": True,
            "voice_id": voice_id,
            "cross_number_match": cross_match is not None,
            "cross_match": cross_match,
            "blocked": blocked,
            "blacklisted": voice_id in self._blacklist,
        }

    def status(self) -> dict[str, Any]:
        return {
            "entries": len(self._entries),
            "blacklisted_voices": len(self._blacklist),
            "similarity_threshold": SIMILARITY_THRESHOLD,
        }