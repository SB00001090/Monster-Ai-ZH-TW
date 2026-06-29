"""Anonymous HK scam report bundle (no PII)."""
from __future__ import annotations

import hashlib
import time
from datetime import datetime, timezone
from typing import Any


def _daily_salt() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def hash_number(number: str) -> str:
    normalized = "".join(c for c in number if c.isdigit() or c == "+")
    payload = f"{normalized}|{_daily_salt()}|monster-callguard"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def build_anonymous_report(
    number: str,
    *,
    category: str,
    signals: list[str],
    score: int,
) -> dict[str, Any]:
    return {
        "version": "hk-report-2026",
        "category": category or "scam_suspicious",
        "number_hash": hash_number(number),
        "score": score,
        "signals": signals[:12],
        "ts": time.time(),
        "report_channels": {
            "adcc_hotline": "18222",
            "e_reporting": "https://www.ereporting.rmp.gov.hk",
            "scameter": "https://cyberdefender.hk/scameter/",
        },
    }