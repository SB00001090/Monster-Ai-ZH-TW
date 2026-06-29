"""Image generation escalation when quality checks keep failing."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from monster_ai.config import ImageQualitySettings
from monster_ai.modules.image.lora_manager import resolve_lora
from monster_ai.modules.image.quality import QualityIssue, QualityReport
from monster_ai.modules.prompt.anti_collapse import safe_insurance_bundle


@dataclass
class ImageRepairState:
    consecutive_quality_fails: int = 0
    last_escalation: str | None = None
    active_checkpoint: str | None = None
    degraded_mode: bool = False
    total_repairs: int = 0


@dataclass
class RetryPlan:
    steps: int
    cfg: float
    width: int
    height: int
    lora_name: str | None
    checkpoint: str
    positive: str
    negative: str
    insurance: bool = False


class ImageRepairEngine:
    def __init__(self, settings: ImageQualitySettings) -> None:
        self.settings = settings
        self.state = ImageRepairState()

    def record_quality_fail(self) -> None:
        self.state.consecutive_quality_fails += 1
        self.state.total_repairs += 1

    def record_quality_pass(self) -> None:
        self.state.consecutive_quality_fails = 0
        self.state.degraded_mode = False
        self.state.last_escalation = None

    def should_escalate(self) -> bool:
        return self.state.consecutive_quality_fails >= self.settings.escalate_after

    def plan_retry(
        self,
        attempt: int,
        *,
        positive: str,
        negative: str,
        checkpoint: str,
        width: int,
        height: int,
        steps: int,
        cfg: float,
        lora_name: str | None,
        report: QualityReport | None = None,
        available_checkpoints: list[str] | None = None,
        available_loras: list[str] | None = None,
    ) -> RetryPlan:
        ckpt = checkpoint
        use_lora = lora_name
        use_steps = steps
        use_cfg = cfg
        use_w, use_h = width, height
        use_pos, use_neg = positive, negative
        insurance = False

        if attempt >= 1:
            use_neg = negative
            use_steps = min(40, steps + 2)
            use_cfg = max(4.0, cfg - 0.5)

        if attempt >= 2:
            use_steps = min(40, steps + 4)
            use_cfg = max(4.0, cfg - 1.0)
            if self.settings.auto_lora_on_retry and available_loras:
                anti = resolve_lora(self.settings.anti_collapse_lora, available_loras)
                if anti:
                    use_lora = anti
                    self.state.last_escalation = f"anti_collapse_lora:{anti}"
            else:
                use_lora = None

        if report and QualityIssue.NOISE_WALL in report.issues and attempt >= 1:
            use_cfg = max(4.0, use_cfg - 1.0)
            use_steps = min(40, use_steps + 2)
            if self.settings.auto_lora_on_retry and available_loras:
                anti = resolve_lora(self.settings.anti_collapse_lora, available_loras)
                if anti:
                    use_lora = anti

        if attempt >= 3:
            use_w, use_h = min(width, 512), min(height, 512)
            fb = self._resolve_fallback(available_checkpoints or [], checkpoint)
            if fb:
                ckpt = fb
                self.state.last_escalation = f"fallback_checkpoint:{fb}"
                self.state.degraded_mode = True

        if self.should_escalate() or attempt >= 4:
            bundle = safe_insurance_bundle(positive, ckpt)
            use_pos = bundle.positive
            use_neg = bundle.negative
            use_steps = bundle.steps
            use_cfg = bundle.cfg
            use_w, use_h = 512, 512
            use_lora = None
            insurance = True
            self.state.last_escalation = "insurance_workflow"
            self.state.degraded_mode = True

        self.state.active_checkpoint = ckpt
        return RetryPlan(
            steps=use_steps,
            cfg=use_cfg,
            width=use_w,
            height=use_h,
            lora_name=use_lora,
            checkpoint=ckpt,
            positive=use_pos,
            negative=use_neg,
            insurance=insurance,
        )

    def _resolve_fallback(self, available: list[str], current: str) -> str | None:
        requested = self.settings.fallback_checkpoint
        if requested and requested != "auto" and requested in available:
            return requested
        prefs = ("v1-5-pruned", "sd_v1", "1.5", "sd15")
        for pref in prefs:
            for name in available:
                if pref in name.lower() and name != current:
                    return name
        for name in available:
            if name != current:
                return name
        return None

    def to_dict(self) -> dict[str, Any]:
        return {
            "consecutive_quality_fails": self.state.consecutive_quality_fails,
            "last_escalation": self.state.last_escalation,
            "active_checkpoint": self.state.active_checkpoint,
            "degraded_mode": self.state.degraded_mode,
            "total_repairs": self.state.total_repairs,
        }