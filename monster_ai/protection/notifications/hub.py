"""Dispatch security notifications to all channels."""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any, Callable, Awaitable

logger = logging.getLogger(__name__)


@dataclass
class SecurityAlert:
    level: str  # warn | block | repair
    message: str
    ip: str = ""
    action: str = ""
    extra: dict[str, Any] = field(default_factory=dict)


class NotificationHub:
    def __init__(self) -> None:
        self._subscribers: list[Callable[[SecurityAlert], Awaitable[None]]] = []
        self._history: list[dict[str, Any]] = []
        self._max_history = 100

    def subscribe(self, handler: Callable[[SecurityAlert], Awaitable[None]]) -> None:
        self._subscribers.append(handler)

    async def notify(self, alert: SecurityAlert) -> None:
        record = {
            "level": alert.level,
            "message": alert.message,
            "ip": alert.ip,
            "action": alert.action,
            **alert.extra,
        }
        self._history.append(record)
        self._history = self._history[-self._max_history :]
        for handler in self._subscribers:
            try:
                await handler(alert)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Notification handler failed: %s", exc)

    def recent(self, limit: int = 20) -> list[dict[str, Any]]:
        return list(reversed(self._history[-limit:]))