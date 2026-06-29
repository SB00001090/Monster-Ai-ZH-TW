"""Service health registry."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class HealthStatus:
    name: str
    healthy: bool
    message: str = ""
    checked_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class HealthRegistry:
    def __init__(self) -> None:
        self._statuses: dict[str, HealthStatus] = {}

    def set(self, name: str, healthy: bool, message: str = "") -> None:
        self._statuses[name] = HealthStatus(
            name=name,
            healthy=healthy,
            message=message,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            name: {
                "healthy": status.healthy,
                "message": status.message,
                "checked_at": status.checked_at,
            }
            for name, status in self._statuses.items()
        }