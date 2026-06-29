"""Tests for MonsterCallGuard module."""
from __future__ import annotations

from pathlib import Path

import pytest

from monster_ai.config import CallGuardSettings
from monster_ai.protection.callguard.engine import CallGuardEngine
from monster_ai.protection.callguard.report import build_anonymous_report, hash_number
from monster_ai.protection.callguard.rules import score_call


def test_debt_collection_display_name_blocks() -> None:
    r = score_call("+85291234567", display_name="財務公司追債還款")
    assert r.score >= 70
    assert r.blocked


def test_benign_call() -> None:
    r = score_call("+85261234567", display_name="媽媽")
    assert not r.reject


def test_anonymous_report_no_raw_number() -> None:
    report = build_anonymous_report(
        "+85299998888",
        category="scam",
        signals=["test"],
        score=90,
    )
    assert "85299998888" not in str(report)
    assert report["number_hash"] == hash_number("+85299998888")


def test_submit_report_device_contact(tmp_path: Path) -> None:
    from monster_ai.protection.callguard.engine import CallGuardEngine
    from monster_ai.protection.callguard.rules import CallScoreResult

    engine = CallGuardEngine(CallGuardSettings(enabled=True), tmp_path)
    result = CallScoreResult(score=90, category="hk_debt_collection", signals=["test"])
    report = engine.submit_report(
        "+85290000000",
        result,
        device_contact={"detected": True, "usb": True},
    )
    assert report["device_contact"]["usb"] is True
    assert "85290000000" not in str(report)


@pytest.mark.asyncio
async def test_engine_analyze(tmp_path: Path) -> None:
    engine = CallGuardEngine(CallGuardSettings(enabled=True), tmp_path)
    await engine.start()
    result = await engine.analyze_call("+85291234567", display_name="收數公司")
    assert result.blocked
    assert engine.state.analyzes_today >= 1