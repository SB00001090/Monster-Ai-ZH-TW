"""Firewall threat scoring rules."""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

TRAVERSAL = re.compile(r"\.\.[\\/]|%2e%2e", re.I)
INJECTION = re.compile(
    r"(;\s*rm\s+-|DROP\s+TABLE|<script|javascript:|onerror=|__import__|eval\s*\()",
    re.I,
)

_DYNAMIC_RULES: list[dict[str, Any]] = []


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

    for rule in _DYNAMIC_RULES:
        pattern = str(rule.get("pattern", ""))
        if not pattern or pattern == ".{0}":
            continue
        try:
            if re.search(pattern, blob, re.I):
                rule_score = int(rule.get("score", 60))
                score = max(score, rule_score)
                reasons.append(str(rule.get("reason", rule.get("id", "dynamic_rule"))))
        except re.error:
            continue

    return ThreatResult(score=score, reasons=reasons)


def reload_dynamic_rules(path: Path | None) -> int:
    global _DYNAMIC_RULES  # noqa: PLW0603
    if path is None or not path.is_file():
        _DYNAMIC_RULES = []
        return 0
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        rules = data.get("rules") if isinstance(data, dict) else None
        _DYNAMIC_RULES = [r for r in rules if isinstance(r, dict)] if isinstance(rules, list) else []
    except (yaml.YAMLError, OSError):
        _DYNAMIC_RULES = []
    return len(_DYNAMIC_RULES)


def dynamic_rule_count() -> int:
    return len(_DYNAMIC_RULES)