"""In-memory progress for long generation jobs."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class GenerationProgress:
    job: str | None = None
    frame: int = 0
    total: int = 0
    message: str = ""
    started_at: str | None = None

    def start(self, job: str, total: int, message: str = "") -> None:
        self.job = job
        self.frame = 0
        self.total = total
        self.message = message
        self.started_at = datetime.now(timezone.utc).isoformat()

    def set_frame(self, frame: int, message: str = "") -> None:
        self.frame = frame
        if message:
            self.message = message

    def clear(self) -> None:
        self.job = None
        self.frame = 0
        self.total = 0
        self.message = ""
        self.started_at = None

    def to_dict(self) -> dict:
        return {
            "job": self.job,
            "frame": self.frame,
            "total": self.total,
            "message": self.message,
            "started_at": self.started_at,
        }