"""Iterative prompt refinement from quality reports."""
from __future__ import annotations

import re
from dataclasses import dataclass

from monster_ai.core.self_repair import SelfRepairEngine
from monster_ai.llm.prompt_templates import SD_REFINE_SYSTEM, SD_REFINE_USER
from monster_ai.modules.image.quality import QualityIssue, QualityReport
from monster_ai.modules.prompt.anti_collapse import build_negative, enhance_positive


@dataclass
class RefinedPrompt:
    positive: str
    negative: str
    steps_delta: int = 0
    cfg_delta: float = 0.0


def _parse_refine_output(text: str, fallback_pos: str, fallback_neg: str) -> RefinedPrompt:
    positive = fallback_pos
    negative = fallback_neg
    steps_delta = 0
    cfg_delta = 0.0

    for line in text.strip().split("\n"):
        line = line.strip()
        if line.lower().startswith("positive:"):
            positive = line.split(":", 1)[1].strip()[:500]
        elif line.lower().startswith("negative:"):
            negative = line.split(":", 1)[1].strip()[:600]
        elif line.lower().startswith("steps_delta:"):
            try:
                steps_delta = int(re.search(r"-?\d+", line).group())  # type: ignore[union-attr]
            except (ValueError, AttributeError):
                pass
        elif line.lower().startswith("cfg_delta:"):
            try:
                cfg_delta = float(re.search(r"-?\d+\.?\d*", line).group())  # type: ignore[union-attr]
            except (ValueError, AttributeError):
                pass

    return RefinedPrompt(
        positive=positive or fallback_pos,
        negative=negative or fallback_neg,
        steps_delta=max(-6, min(6, steps_delta)),
        cfg_delta=max(-2.0, min(2.0, cfg_delta)),
    )


class PromptRefiner:
    def __init__(self, repair: SelfRepairEngine) -> None:
        self.repair = repair

    def rule_based(self, positive: str, negative: str, report: QualityReport) -> RefinedPrompt:
        new_neg = build_negative(negative, report.issues)
        new_pos = positive
        steps_delta = 0
        cfg_delta = 0.0

        issue_set = set(report.issues)
        if QualityIssue.BLACK_IMAGE in issue_set or QualityIssue.WHITE_IMAGE in issue_set:
            new_pos = enhance_positive(f"well lit scene, {positive}")
            cfg_delta = -0.5
        if QualityIssue.OVERSATURATED in issue_set:
            cfg_delta -= 0.5
        if QualityIssue.LOW_EDGE in issue_set:
            steps_delta += 2
        if QualityIssue.NOISE_WALL in issue_set:
            cfg_delta -= 1.0
            steps_delta += 2
            new_pos = re.sub(
                r"(8k|ultra detailed|masterpiece|best quality),?\s*",
                "",
                new_pos,
                flags=re.I,
            )
            new_neg = build_negative(
                new_neg + ", grainy, noisy, speckled, high frequency noise",
                report.issues,
            )

        return RefinedPrompt(
            positive=new_pos[:500],
            negative=new_neg,
            steps_delta=steps_delta,
            cfg_delta=cfg_delta,
        )

    async def refine(
        self,
        positive: str,
        negative: str,
        report: QualityReport,
        attempt: int,
    ) -> RefinedPrompt:
        fallback = self.rule_based(positive, negative, report)
        issues_text = "; ".join(report.reasons) or "unknown quality issue"
        user = SD_REFINE_USER.format(
            positive=positive,
            negative=negative,
            issues=issues_text,
            attempt=attempt + 1,
        )
        try:
            raw = await self.repair.generate(user, system=SD_REFINE_SYSTEM)
            parsed = _parse_refine_output(raw, fallback.positive, fallback.negative)
            if not parsed.positive.strip():
                return fallback
            return RefinedPrompt(
                positive=parsed.positive,
                negative=parsed.negative or fallback.negative,
                steps_delta=parsed.steps_delta or fallback.steps_delta,
                cfg_delta=parsed.cfg_delta or fallback.cfg_delta,
            )
        except Exception:  # noqa: BLE001
            return fallback