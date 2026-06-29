"""Tests for hardware probe and tier orchestrator."""
from __future__ import annotations

from monster_ai.config import Settings
from monster_ai.core.hardware_probe import HardwareProbeResult, _classify_tier, _backends_for_tier
from monster_ai.protection.tier_orchestrator import ProtectionTierOrchestrator


def test_classify_cpu_only() -> None:
    assert _classify_tier(16.0, 0, "windows") == "cpu_only"


def test_classify_low_vram() -> None:
    assert _classify_tier(16.0, 4096, "windows") == "low_vram"


def test_classify_mobile() -> None:
    assert _classify_tier(4.0, 0, "android") == "mobile"


def test_backends_mobile_rules_only() -> None:
    assert _backends_for_tier("mobile") == ["rules"]


def test_tier_orchestrator_cpu_only() -> None:
    settings = Settings()
    probe = HardwareProbeResult(tier="cpu_only", ram_gb=8, vram_mb=0)
    result = ProtectionTierOrchestrator(settings, probe).apply()
    assert result.tier == "cpu_only"
    assert settings.protection.monsterlock.bind_gpu is False