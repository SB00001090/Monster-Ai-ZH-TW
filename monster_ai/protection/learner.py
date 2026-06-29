"""Learning mode: log threats and escalate to bans."""
from __future__ import annotations

import json
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from pathlib import Path


@dataclass
class LearnEvent:
    ip: str
    score: int
    reasons: list[str]
    path: str
    timestamp: float


class LearningAnalyzer:
    def __init__(
        self,
        log_path: Path,
        *,
        escalate_count: int = 5,
        escalate_window_minutes: int = 10,
    ) -> None:
        self.log_path = log_path
        self.escalate_count = escalate_count
        self.escalate_window = escalate_window_minutes * 60
        self.log_path.parent.mkdir(parents=True, exist_ok=True)
        self._warnings: dict[str, deque[float]] = defaultdict(deque)

    def record(self, event: LearnEvent) -> None:
        with self.log_path.open("a", encoding="utf-8") as f:
            f.write(
                json.dumps(
                    {
                        "ip": event.ip,
                        "score": event.score,
                        "reasons": event.reasons,
                        "path": event.path,
                        "timestamp": event.timestamp,
                    },
                    ensure_ascii=False,
                )
                + "\n"
            )
        now = event.timestamp
        q = self._warnings[event.ip]
        q.append(now)
        while q and now - q[0] > self.escalate_window:
            q.popleft()

    def should_escalate(self, ip: str) -> bool:
        q = self._warnings.get(ip)
        return bool(q and len(q) >= self.escalate_count)