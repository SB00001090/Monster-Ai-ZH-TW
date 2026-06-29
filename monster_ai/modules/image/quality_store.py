"""Archive good/bad images and append quality_log.jsonl for training."""
from __future__ import annotations

import json
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from monster_ai.config import ImageQualitySettings
from monster_ai.modules.image.quality import QualityReport


class QualityStore:
    def __init__(self, base_dir: str | Path, settings: ImageQualitySettings) -> None:
        self.base = Path(base_dir)
        self.settings = settings
        self.bad_dir = self.base / "bad"
        self.good_dir = self.base / "good"
        self.pending_dir = self.base / "pending"
        self.log_path = self.base / "quality_log.jsonl"
        for d in (self.bad_dir, self.good_dir, self.pending_dir):
            d.mkdir(parents=True, exist_ok=True)

    def _archive(
        self,
        src: Path,
        dest_dir: Path,
        *,
        label: str,
        prompt: str,
        negative: str,
        report: QualityReport,
        checkpoint: str,
        attempt: int,
        extra: dict[str, Any] | None = None,
    ) -> Path:
        stem = f"{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
        dest_img = dest_dir / f"{stem}.png"
        shutil.copy2(src, dest_img)
        meta = {
            "id": stem,
            "label": label,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "prompt": prompt,
            "negative": negative,
            "checkpoint": checkpoint,
            "attempt": attempt,
            "quality": report.to_dict(),
            **(extra or {}),
        }
        (dest_dir / f"{stem}.json").write_text(
            json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        self._append_log(meta)
        return dest_img

    def _append_log(self, record: dict[str, Any]) -> None:
        with self.log_path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

    def save_bad(
        self,
        src: Path,
        *,
        prompt: str,
        negative: str,
        report: QualityReport,
        checkpoint: str,
        attempt: int,
        extra: dict[str, Any] | None = None,
    ) -> Path | None:
        if not self.settings.save_bad:
            return None
        return self._archive(
            src,
            self.bad_dir,
            label="bad",
            prompt=prompt,
            negative=negative,
            report=report,
            checkpoint=checkpoint,
            attempt=attempt,
            extra=extra,
        )

    def save_good(
        self,
        src: Path,
        *,
        prompt: str,
        negative: str,
        report: QualityReport,
        checkpoint: str,
        attempt: int,
        extra: dict[str, Any] | None = None,
    ) -> Path | None:
        if not self.settings.save_good:
            return None
        return self._archive(
            src,
            self.good_dir,
            label="good",
            prompt=prompt,
            negative=negative,
            report=report,
            checkpoint=checkpoint,
            attempt=attempt,
            extra=extra,
        )