"""Tests for MonsterGuard rule scorer."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from monster_ai.modules.discord.guard.scorer import RuleScorer
from monster_ai.modules.discord.guard.threat import MessageContext


def _ctx(content: str, *, days_old: float = 30) -> MessageContext:
    created = datetime.now(timezone.utc) - timedelta(days=days_old)
    scorer = RuleScorer()
    return MessageContext(
        content=content,
        urls=scorer.extract_urls(content),
        author_id=1,
        author_name="test",
        account_created_at=created,
        guild_id=1,
        channel_id=1,
        message_id=1,
        attachment_names=[],
        mention_everyone=False,
    )


def test_fake_nitro_detected():
    ctx = _ctx("@everyone FREE NITRO https://discrod-gift.com/claim")
    ctx.mention_everyone = True
    result = RuleScorer().score(ctx)
    assert result.score >= 70
    assert result.scam_type == "nitro"


def test_verification_scam():
    result = RuleScorer().score(_ctx("Please verify your account at https://discord-verify.com"))
    assert result.score >= 45
    assert result.scam_type == "verification"


def test_benign_message_low_score():
    result = RuleScorer().score(_ctx("hello everyone, how is your day?"))
    assert result.score < 50