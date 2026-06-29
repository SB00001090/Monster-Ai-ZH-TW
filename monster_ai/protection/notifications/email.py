"""SMTP email security notifications."""
from __future__ import annotations

import logging
import os
import smtplib
from email.mime.text import MIMEText

from monster_ai.protection.notifications.hub import SecurityAlert

logger = logging.getLogger(__name__)


class EmailNotifier:
    def __init__(
        self,
        *,
        smtp_host: str,
        smtp_port: int,
        from_addr: str,
        to_addr: str,
        password_env: str,
    ) -> None:
        self.smtp_host = smtp_host
        self.smtp_port = smtp_port
        self.from_addr = from_addr
        self.to_addr = to_addr
        self.password_env = password_env

    async def handle_alert(self, alert: SecurityAlert) -> None:
        if not self.smtp_host or not self.to_addr:
            return
        password = os.getenv(self.password_env, "")
        body = f"[{alert.level}] {alert.message}\nIP: {alert.ip}\nAction: {alert.action}"
        msg = MIMEText(body)
        msg["Subject"] = f"Monster AI Security: {alert.level}"
        msg["From"] = self.from_addr
        msg["To"] = self.to_addr
        try:
            with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=15) as server:
                server.starttls()
                if password:
                    server.login(self.from_addr, password)
                server.send_message(msg)
        except OSError as exc:
            logger.warning("Email notification failed: %s", exc)