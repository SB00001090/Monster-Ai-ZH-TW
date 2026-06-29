"""WebSocket security alert broadcaster."""
from __future__ import annotations

import json
from typing import Any

from fastapi import WebSocket

from monster_ai.protection.notifications.hub import SecurityAlert


class WebUINotifier:
    def __init__(self) -> None:
        self._clients: set[WebSocket] = set()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._clients.add(ws)

    def disconnect(self, ws: WebSocket) -> None:
        self._clients.discard(ws)

    async def handle_alert(self, alert: SecurityAlert) -> None:
        payload = {
            "level": alert.level,
            "message": alert.message,
            "ip": alert.ip,
            "action": alert.action,
        }
        dead: list[WebSocket] = []
        for ws in self._clients:
            try:
                await ws.send_text(json.dumps(payload))
            except Exception:  # noqa: BLE001
                dead.append(ws)
        for ws in dead:
            self._clients.discard(ws)