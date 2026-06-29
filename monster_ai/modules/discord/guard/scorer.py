"""Rule-based scam scoring for Discord messages."""
from __future__ import annotations

import re
from pathlib import Path

import yaml

from monster_ai.modules.discord.guard.threat import MessageContext, ThreatResult

_URL_RE = re.compile(r"https?://[^\s<>\"']+", re.I)

# P0 — Fake Nitro / Giveaway
_NITRO_PATTERNS = [
    (re.compile(r"discord[\s.-]*gift|discord[\s.-]*nitro|free\s+nitro", re.I), 45, "nitro"),
    (re.compile(r"steamcommunlty|steamcommunty|steancommunity", re.I), 50, "nitro"),
    (re.compile(r"nitro\s+giveaway|claim\s+your\s+nitro", re.I), 40, "nitro"),
    (re.compile(r"@everyone.*https?://|https?://.*@everyone", re.I | re.S), 30, "nitro"),
]

# P0 — Fake Verification
_VERIFY_PATTERNS = [
    (re.compile(r"verify\s+your\s+account|account\s+verification", re.I), 45, "verification"),
    (re.compile(r"human\s+verification|captcha\s+required", re.I), 40, "verification"),
    (re.compile(r"sync\s+your\s+roles|role\s+sync", re.I), 35, "verification"),
    (re.compile(r"discord\s+moderator\s+application", re.I), 30, "verification"),
]

# P1 — Crypto / MrBeast
_CRYPTO_PATTERNS = [
    (re.compile(r"double\s+your\s+(crypto|btc|eth)|airdrop", re.I), 45, "crypto"),
    (re.compile(r"wallet\s+connect|seed\s+phrase|private\s+key", re.I), 50, "crypto"),
    (re.compile(r"mr\s*beast|mrbeast", re.I), 35, "crypto"),
    (re.compile(r"giveaway\s+ends\s+in|send\s+\d+\s*eth", re.I), 30, "crypto"),
]

# P1 — Hacked DM patterns
_HACKED_DM_PATTERNS = [
    (re.compile(r"hey\s+check\s+this\s+out|is\s+this\s+you\??", re.I), 25, "hacked_dm"),
    (re.compile(r"look\s+what\s+i\s+found|did\s+you\s+make\s+this", re.I), 25, "hacked_dm"),
]

# P1 — Game download / malware
_MALWARE_PATTERNS = [
    (re.compile(r"beta\s+key|free\s+robux|mod\s+menu|cracked\s+version", re.I), 40, "malware"),
    (re.compile(r"download\s+now.*\.(exe|msi|apk|bat)", re.I), 50, "malware"),
    (re.compile(r"free\s+(vbucks|minecoins|steam\s+key)", re.I), 35, "malware"),
]

# Urgency + free promise combo
_URGENCY = re.compile(r"expires?\s+in|limited\s+time|act\s+now|hurry", re.I)
_FREE = re.compile(r"\bfree\b|100%\s+free|no\s+cost", re.I)


class RuleScorer:
    def __init__(self, rules_path: Path | None = None) -> None:
        self._extra_keywords: list[tuple[re.Pattern[str], int, str]] = []
        if rules_path and rules_path.exists():
            self._load_yaml(rules_path)

    def _load_yaml(self, path: Path) -> None:
        with path.open(encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        for rule in data.get("keyword_rules", []):
            self._extra_keywords.append(
                (re.compile(rule["pattern"], re.I), rule["score"], rule.get("type", "phishing"))
            )

    def extract_urls(self, text: str) -> list[str]:
        return _URL_RE.findall(text)

    def score(self, ctx: MessageContext) -> ThreatResult:
        if ctx.is_bot:
            return ThreatResult(score=0, reasons=[])

        result = ThreatResult()
        blob = ctx.content

        for patterns in (
            _NITRO_PATTERNS,
            _VERIFY_PATTERNS,
            _CRYPTO_PATTERNS,
            _HACKED_DM_PATTERNS,
            _MALWARE_PATTERNS,
            self._extra_keywords,
        ):
            for pattern, score, scam_type in patterns:
                if pattern.search(blob):
                    result.merge(
                        ThreatResult(
                            score=score,
                            reasons=[f"rule:{scam_type}"],
                            scam_type=scam_type,
                        )
                    )

        if _URGENCY.search(blob) and _FREE.search(blob):
            result.merge(
                ThreatResult(score=25, reasons=["rule:urgency_free_combo"], scam_type="phishing")
            )

        if ctx.mention_everyone and ctx.urls:
            result.merge(
                ThreatResult(score=30, reasons=["rule:mass_mention_link"], scam_type="nitro")
            )

        for name in ctx.attachment_names:
            lower = name.lower()
            if lower.endswith((".exe", ".msi", ".apk", ".bat", ".scr", ".cmd")):
                result.merge(
                    ThreatResult(score=50, reasons=["rule:dangerous_attachment"], scam_type="malware")
                )

        if ctx.account_age_days < 1:
            result.merge(ThreatResult(score=40, reasons=["behavior:new_account_1d"]))
        elif ctx.account_age_days < 7:
            result.merge(ThreatResult(score=20, reasons=["behavior:new_account_7d"]))

        if ctx.urls and ctx.account_age_days < 7:
            result.merge(
                ThreatResult(score=15, reasons=["behavior:new_account_with_link"], scam_type="hacked_dm")
            )

        return result