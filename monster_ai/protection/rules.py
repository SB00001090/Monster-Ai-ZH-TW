"""Firewall threat scoring rules."""
from __future__ import annotations

import re
from dataclasses import dataclass

TRAVERSAL = re.compile(r"\.\.[\\/]|%2e%2e", re.I)
INJECTION = re.compile(
    r"(;\s*rm\s+-|DROP\s+TABLE|<script|javascript:|onerror=|__import__|eval\s*\()",
    re.I,
)


@dataclass
class ThreatResult:
    score: int
    reasons: list[str]


def score_request(
    *,
    path: str,
    query: str = "",
    body_preview: str = "",
    method: str = "GET",
    recent_404_count: int = 0,
    requests_last_minute: int = 0,
) -> ThreatResult:
    score = 0
    reasons: list[str] = []
    blob = f"{path} {query} {body_preview}"

    if TRAVERSAL.search(blob):
        score += 80
        reasons.append("path_traversal")

    if INJECTION.search(blob):
        score += 70
        reasons.append("injection_pattern")

    if requests_last_minute > 120:
        score += 50
        reasons.append("burst_traffic")

    if recent_404_count >= 20:
        score += 40
        reasons.append("api_scan")

    if method not in {"GET", "POST", "PATCH", "DELETE", "HEAD", "OPTIONS"}:
        score += 20
        reasons.append("unusual_method")

    if len(body_preview) > 65536:
        score += 30
        reasons.append("oversized_payload")

    return ThreatResult(score=score, reasons=reasons)