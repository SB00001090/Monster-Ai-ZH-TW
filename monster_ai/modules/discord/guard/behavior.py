"""Behavioral pattern detection: spam, raid, duplicate messages."""
from __future__ import annotations

import hashlib
import time
from collections import defaultdict, deque

from monster_ai.modules.discord.guard.threat import MessageContext, ThreatResult


class BehaviorTracker:
    def __init__(self, *, window_seconds: int = 300, duplicate_threshold: int = 3) -> None:
        self._window = window_seconds
        self._duplicate_threshold = duplicate_threshold
        self._message_hashes: dict[int, deque[tuple[float, str]]] = defaultdict(deque)
        self._guild_burst: dict[int, deque[tuple[float, int]]] = defaultdict(deque)

    @staticmethod
    def _content_hash(content: str) -> str:
        normalized = " ".join(content.lower().split())
        return hashlib.sha256(normalized.encode()).hexdigest()[:16]

    def score(self, ctx: MessageContext) -> ThreatResult:
        now = time.monotonic()
        result = ThreatResult()
        content_hash = self._content_hash(ctx.content)

        user_q = self._message_hashes[ctx.author_id]
        user_q.append((now, content_hash))
        while user_q and now - user_q[0][0] > self._window:
            user_q.popleft()

        same_hash = sum(1 for _, h in user_q if h == content_hash)
        if same_hash >= self._duplicate_threshold:
            result.merge(
                ThreatResult(
                    score=35,
                    reasons=["behavior:duplicate_spam"],
                    scam_type="raid",
                    recommended_action="delete",
                )
            )

        if len(user_q) >= 5 and (now - user_q[0][0]) < 60:
            result.merge(
                ThreatResult(score=30, reasons=["behavior:message_burst"], scam_type="raid")
            )

        guild_q = self._guild_burst[ctx.guild_id]
        guild_q.append((now, ctx.author_id))
        while guild_q and now - guild_q[0][0] > 10:
            guild_q.popleft()

        unique_new = len({uid for _, uid in guild_q})
        if unique_new >= 5 and ctx.account_age_days < 7:
            result.merge(
                ThreatResult(
                    score=40,
                    reasons=["behavior:possible_raid"],
                    scam_type="raid",
                    recommended_action="delete",
                )
            )

        return result