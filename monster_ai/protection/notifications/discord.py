"""Discord webhook security notifications."""
from __future__ import annotations

import logging

import httpx

from monster_ai.protection.notifications.hub import SecurityAlert

logger = logging.getLogger(__name__)


class DiscordNotifier:
    def __init__(self, webhook_url: str) -> None:
        self.webhook_url = webhook_url.strip()

    async def handle_alert(self, alert: SecurityAlert) -> None:
        if not self.webhook_url:
            return
        content = f"**[{alert.level.upper()}]** {alert.message}"
        if alert.ip:
            content += f" (IP: {alert.ip})"
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(self.webhook_url, json={"content": content[:1900]})
        except httpx.HTTPError as exc:
            logger.warning("Discord webhook failed: %s", exc)