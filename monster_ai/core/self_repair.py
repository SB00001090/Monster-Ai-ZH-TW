"""Auto-heal: health checks, retries, tier-aware model fallback chain."""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING

from monster_ai.config import Settings
from monster_ai.core.hardware_probe import detect_hardware
from monster_ai.llm.fallback import FallbackLLM
from monster_ai.llm.runtime import InferenceRuntime
from monster_ai.protection.tier_orchestrator import ProtectionTierOrchestrator

if TYPE_CHECKING:
    from monster_ai.core.hardware_probe import HardwareProbeResult
    from monster_ai.protection.tier_orchestrator import TierApplyResult

logger = logging.getLogger(__name__)


@dataclass
class RepairState:
    primary_ok: bool = False
    active_backend: str = "none"
    last_error: str | None = None
    repair_count: int = 0
    hardware_tier: str = "cpu_only"


class SelfRepairEngine:
    def __init__(
        self,
        settings: Settings,
        *,
        root: Path | None = None,
        runtime: InferenceRuntime | None = None,
        probe: HardwareProbeResult | None = None,
        tier_result: TierApplyResult | None = None,
    ) -> None:
        self.settings = settings
        self.root = root or Path(__file__).resolve().parent.parent.parent
        self.probe = probe or detect_hardware()
        self.tier_result = tier_result or ProtectionTierOrchestrator(settings, self.probe).apply()
        self.runtime = runtime or InferenceRuntime(settings, self.probe, self.root)
        self.fallback = FallbackLLM()
        self.state = RepairState(hardware_tier=self.probe.tier)
        self._task: asyncio.Task | None = None

    async def start(self) -> None:
        await self._heal_once()
        self._task = asyncio.create_task(self._loop())

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _loop(self) -> None:
        while True:
            await asyncio.sleep(self.settings.repair.interval_seconds)
            await self._heal_once()

    async def _heal_once(self) -> None:
        try:
            await self.runtime.heal()
        except Exception as exc:  # noqa: BLE001
            self.state.last_error = str(exc)
            self.state.primary_ok = False
            self.state.active_backend = "rules"
            self.state.repair_count += 1
            return

        self.state.primary_ok = self.runtime.state.primary_ok
        self.state.active_backend = self.runtime.state.active_backend
        self.state.last_error = self.runtime.state.last_error
        self.state.hardware_tier = self.probe.tier
        if not self.state.primary_ok:
            self.state.repair_count += 1
            logger.warning(
                "Primary LLM unhealthy (tier=%s); using %s. %s",
                self.probe.tier,
                self.state.active_backend,
                self.state.last_error,
            )

    async def generate(self, prompt: str, system: str | None = None) -> str:
        retries = self.settings.repair.max_retries
        for attempt in range(retries + 1):
            if self.state.primary_ok:
                try:
                    return await self.runtime.generate(prompt, system=system)
                except Exception as exc:
                    self.state.last_error = str(exc)
                    self.state.primary_ok = False
                    if attempt < retries:
                        await asyncio.sleep(0.5 * (2**attempt))
            else:
                break
        self.state.active_backend = "rules"
        return await self.fallback.generate(prompt, system=system)

    @property
    def llm_analysis_enabled(self) -> bool:
        return self.runtime.llm_analysis_enabled

    def hardware_dict(self) -> dict:
        return {
            "tier": self.probe.tier,
            "tier_applied": self.tier_result.to_dict(),
            "runtime": self.runtime.to_dict(),
        }