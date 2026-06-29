"""Tests for prompt refinement."""
from __future__ import annotations

import pytest

from monster_ai.modules.image.quality import QualityIssue, QualityReport
from monster_ai.modules.prompt.anti_collapse import build_negative
from monster_ai.modules.prompt.refinement import PromptRefiner, _parse_refine_output


class _FakeRepair:
    async def generate(self, prompt: str, system: str | None = None) -> str:
        return (
            "Positive: well lit portrait, detailed face\n"
            "Negative: blurry, deformed\n"
            "Steps_delta: 2\n"
            "CFG_delta: -0.5"
        )


def test_parse_refine_output() -> None:
    raw = (
        "Positive: cinematic lighting, cat\n"
        "Negative: blurry, black image\n"
        "Steps_delta: 3\n"
        "CFG_delta: -1"
    )
    r = _parse_refine_output(raw, "fallback pos", "fallback neg")
    assert "cat" in r.positive
    assert "black image" in r.negative
    assert r.steps_delta == 3
    assert r.cfg_delta == -1.0


def test_rule_based_black_image() -> None:
    refiner = PromptRefiner(_FakeRepair())  # type: ignore[arg-type]
    report = QualityReport(
        passed=False,
        score=0.1,
        issues=[QualityIssue.BLACK_IMAGE],
        reasons=["black"],
    )
    r = refiner.rule_based("dark scene", "low quality", report)
    assert "well lit" in r.positive.lower() or "masterpiece" in r.positive.lower()
    assert r.cfg_delta <= 0


def test_build_negative_adds_issue_hints() -> None:
    neg = build_negative("blurry", [QualityIssue.OVERSATURATED])
    assert "muted colors" in neg or "natural saturation" in neg


@pytest.mark.asyncio
async def test_refiner_uses_llm() -> None:
    refiner = PromptRefiner(_FakeRepair())  # type: ignore[arg-type]
    report = QualityReport(passed=False, score=0.2, issues=[QualityIssue.LOW_EDGE], reasons=["blur"])
    r = await refiner.refine("portrait", "blurry", report, 0)
    assert "portrait" in r.positive.lower() or "face" in r.positive.lower()