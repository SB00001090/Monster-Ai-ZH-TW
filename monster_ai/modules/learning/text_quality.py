"""Text response quality validation (Phase B)."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any


@dataclass
class TextQualityReport:
    passed: bool
    score: float
    reasons: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {"passed": self.passed, "score": self.score, "reasons": self.reasons}


def evaluate_text_response(
    text: str,
    *,
    user_message: str = "",
    min_score: float = 0.55,
    min_length: int = 8,
    max_length: int = 12000,
) -> TextQualityReport:
    reasons: list[str] = []
    score = 1.0
    stripped = (text or "").strip()

    if len(stripped) < min_length:
        reasons.append("too_short")
        score -= 0.5
    if len(stripped) > max_length:
        reasons.append("too_long")
        score -= 0.2
    if not stripped:
        reasons.append("empty")
        score = 0.0
    if re.search(r"(?i)(i cannot|i can't help|as an ai|language model)", stripped):
        reasons.append("refusal_tone")
        score -= 0.25
    if user_message and len(user_message) > 3:
        overlap = _token_overlap(user_message, stripped)
        if overlap < 0.05:
            reasons.append("low_relevance")
            score -= 0.35
    if stripped.count("?") > 8:
        reasons.append("excessive_questions")
        score -= 0.1

    score = max(0.0, min(1.0, score))
    passed = score >= min_score and "empty" not in reasons and "too_short" not in reasons
    return TextQualityReport(passed=passed, score=score, reasons=reasons)


def _token_overlap(a: str, b: str) -> float:
    ta = {t.lower() for t in re.findall(r"\w+", a) if len(t) > 2}
    tb = {t.lower() for t in re.findall(r"\w+", b) if len(t) > 2}
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta)