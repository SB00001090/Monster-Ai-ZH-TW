"""Apply hardware-tier overrides to protection modules at startup."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from monster_ai.config import Settings
from monster_ai.core.hardware_probe import HardwareProbeResult

logger = logging.getLogger(__name__)

TIER_OVERRIDES: dict[str, dict[str, Any]] = {
    "mobile": {
        "monsterlock": {"strength": "light", "bind_gpu": False, "check_interval_seconds": 60},
        "crimeguard": {
            "llm_analysis_enabled": False,
            "vpn_scan_interval_seconds": 60,
            "device_contact_scan_interval_seconds": 60,
        },
        "callguard": {"llm_analysis_enabled": False},
    },
    "cpu_only": {
        "monsterlock": {"strength": "standard", "bind_gpu": False, "check_interval_seconds": 45},
        "crimeguard": {
            "vpn_scan_interval_seconds": 30,
            "device_contact_scan_interval_seconds": 20,
        },
        "callguard": {},
    },
    "low_vram": {
        "monsterlock": {"strength": "standard", "bind_gpu": True},
        "crimeguard": {
            "vpn_scan_interval_seconds": 20,
            "device_contact_scan_interval_seconds": 15,
        },
    },
    "mid_vram": {"monsterlock": {"strength": "standard", "bind_gpu": True}},
    "high_vram": {
        "monsterlock": {"strength": "strict", "bind_gpu": True},
        "crimeguard": {"llm_analysis_enabled": True},
        "callguard": {"llm_analysis_enabled": True},
    },
}


@dataclass
class TierApplyResult:
    tier: str
    applied: dict[str, dict[str, Any]]

    def to_dict(self) -> dict[str, Any]:
        return {"tier": self.tier, "applied": self.applied}


class ProtectionTierOrchestrator:
    def __init__(self, settings: Settings, probe: HardwareProbeResult) -> None:
        self.settings = settings
        self.probe = probe

    def apply(self) -> TierApplyResult:
        overrides = TIER_OVERRIDES.get(self.probe.tier, {})
        applied: dict[str, dict[str, Any]] = {}

        for section, values in overrides.items():
            target = getattr(self.settings.protection, section, None)
            if target is None:
                continue
            for k, v in values.items():
                if hasattr(target, k):
                    setattr(target, k, v)
            applied[section] = values

        if self.probe.ram_gb < 8:
            self.settings.protection.monsterlock.credential_ttl_seconds = 1.0

        logger.info("Protection tier %s applied: %s", self.probe.tier, list(applied.keys()))
        return TierApplyResult(tier=self.probe.tier, applied=applied)