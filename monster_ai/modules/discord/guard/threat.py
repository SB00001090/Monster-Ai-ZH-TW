"""Threat scoring types for MonsterGuard."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


SCAM_TYPES = (
    "nitro",
    "verification",
    "crypto",
    "hacked_dm",
    "malware",
    "raid",
    "phishing",
    "none",
)


@dataclass
class ThreatResult:
    score: int = 0
    reasons: list[str] = field(default_factory=list)
    scam_type: str | None = None
    confidence: float = 0.0
    recommended_action: str = "monitor"

    def merge(self, other: ThreatResult) -> ThreatResult:
        self.score = min(100, self.score + other.score)
        for reason in other.reasons:
            if reason not in self.reasons:
                self.reasons.append(reason)
        if other.scam_type and other.scam_type != "none":
            if not self.scam_type or other.score > 0:
                self.scam_type = other.scam_type
        if other.confidence > self.confidence:
            self.confidence = other.confidence
        if other.recommended_action != "monitor":
            self.recommended_action = other.recommended_action
        return self


@dataclass
class MessageContext:
    content: str
    urls: list[str]
    author_id: int
    author_name: str
    account_created_at: datetime
    guild_id: int
    channel_id: int
    message_id: int
    attachment_names: list[str]
    mention_everyone: bool
    block_threshold: int = 80
    warn_threshold: int = 50
    ai_threshold: int = 40
    is_bot: bool = False
    extra: dict[str, Any] = field(default_factory=dict)

    @property
    def account_age_days(self) -> float:
        now = datetime.now(self.account_created_at.tzinfo or timezone.utc)
        created = self.account_created_at
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        return (now - created).total_seconds() / 86400