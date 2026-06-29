"""Persist and query generation job history."""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from monster_ai.config import HistorySettings


class GenerationHistory:
    def __init__(self, settings: HistorySettings) -> None:
        self.settings = settings
        self.base = Path(settings.dir)
        self.index_path = self.base / "index.jsonl"
        self.records_dir = self.base / "records"
        self.base.mkdir(parents=True, exist_ok=True)
        self.records_dir.mkdir(parents=True, exist_ok=True)

    def record(self, job_type: str, payload: dict[str, Any]) -> str:
        if not self.settings.enabled:
            return ""
        job_id = payload.get("id") or uuid.uuid4().hex
        now = datetime.now(timezone.utc)
        date_key = now.strftime("%Y-%m-%d")
        summary = {
            "id": job_id,
            "timestamp": now.isoformat(),
            "type": job_type,
            "prompt": (payload.get("prompt") or "")[:200],
            "checkpoint": payload.get("checkpoint"),
            "output_path": payload.get("path") or payload.get("output_path"),
            "quality_passed": (payload.get("quality") or {}).get("passed"),
            "quality_score": (payload.get("quality") or {}).get("score"),
        }
        full = {
            **summary,
            **payload,
            "id": job_id,
            "timestamp": summary["timestamp"],
            "type": job_type,
        }
        day_dir = self.records_dir / date_key
        day_dir.mkdir(parents=True, exist_ok=True)
        (day_dir / f"{job_id}.json").write_text(
            json.dumps(full, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        with self.index_path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(summary, ensure_ascii=False) + "\n")
        return job_id

    def list_entries(
        self,
        *,
        date: str | None = None,
        job_type: str | None = None,
        query: str | None = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        if not self.index_path.exists():
            return []
        entries: list[dict[str, Any]] = []
        for line in self.index_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            if date and not row.get("timestamp", "").startswith(date):
                continue
            if job_type and row.get("type") != job_type:
                continue
            if query and query.lower() not in (row.get("prompt") or "").lower():
                continue
            entries.append(row)
        return list(reversed(entries[-limit:]))

    def get_entry(self, job_id: str) -> dict[str, Any] | None:
        if not self.records_dir.exists():
            return None
        for path in self.records_dir.rglob(f"{job_id}.json"):
            return json.loads(path.read_text(encoding="utf-8"))
        return None

    def purge_older_than(self, days: int) -> int:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        removed = 0
        kept_lines: list[str] = []
        if self.index_path.exists():
            for line in self.index_path.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line:
                    continue
                try:
                    row = json.loads(line)
                    ts = datetime.fromisoformat(row["timestamp"])
                    if ts.tzinfo is None:
                        ts = ts.replace(tzinfo=timezone.utc)
                    if ts < cutoff:
                        removed += 1
                        rec = self.records_dir
                        for p in rec.rglob(f"{row['id']}.json"):
                            p.unlink(missing_ok=True)
                        continue
                    kept_lines.append(line)
                except (json.JSONDecodeError, KeyError, ValueError):
                    kept_lines.append(line)
            self.index_path.write_text(
                "\n".join(kept_lines) + ("\n" if kept_lines else ""), encoding="utf-8"
            )
        return removed

    def purge_on_startup(self) -> int:
        if not self.settings.auto_purge_on_startup:
            return 0
        return self.purge_older_than(self.settings.retention_days)