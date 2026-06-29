"""Static anti-collapse prompt helpers and safe generation defaults."""
from __future__ import annotations

from dataclasses import dataclass

from monster_ai.modules.image.checkpoint_resolver import is_sdxl_checkpoint
from monster_ai.modules.image.quality import QualityIssue

DEFAULT_NEGATIVE = (
    "deformed, distorted, disfigured, bad anatomy, extra limbs, missing limbs, "
    "fused fingers, text, watermark, blurry, low quality, oversaturated, "
    "monochrome noise, jpeg artifacts, black image, white image, ugly, duplicate"
)

DEFAULT_POSITIVE_SUFFIX = "masterpiece, best quality, highly detailed"

ISSUE_NEGATIVE_HINTS: dict[QualityIssue, str] = {
    QualityIssue.BLACK_IMAGE: "well lit, visible subject, proper exposure",
    QualityIssue.WHITE_IMAGE: "balanced exposure, natural lighting, visible details",
    QualityIssue.LOW_VARIANCE: "rich colors, detailed textures, varied tones",
    QualityIssue.LOW_ENTROPY: "detailed scene, complex composition",
    QualityIssue.OVERSATURATED: "muted colors, natural saturation, realistic tones",
    QualityIssue.LOW_EDGE: "sharp focus, crisp details, clear edges",
    QualityIssue.NOISE_WALL: "clean image, smooth gradients, no noise",
    QualityIssue.LOW_CLIP: "accurate composition, clear subject",
    QualityIssue.LOW_AESTHETIC: "professional photography, pleasing composition",
}


@dataclass
class SafePromptBundle:
    positive: str
    negative: str
    steps: int
    cfg: float


def build_negative(base: str | None = None, issues: list[QualityIssue] | None = None) -> str:
    parts = [base or DEFAULT_NEGATIVE]
    if issues:
        for issue in issues:
            hint = ISSUE_NEGATIVE_HINTS.get(issue)
            if hint and hint not in parts[-1]:
                parts.append(hint)
    merged = ", ".join(dict.fromkeys(p.strip() for part in parts for p in part.split(",") if p.strip()))
    return merged[:600]


def enhance_positive(prompt: str, *, add_quality_tags: bool = True) -> str:
    if not add_quality_tags:
        return prompt
    if "masterpiece" in prompt.lower() or "best quality" in prompt.lower():
        return prompt
    return f"{DEFAULT_POSITIVE_SUFFIX}, {prompt}"


def suggest_cfg(checkpoint: str, base_cfg: float) -> float:
    if is_sdxl_checkpoint(checkpoint):
        return min(base_cfg, 7.0)
    return base_cfg


def safe_insurance_bundle(
    prompt: str,
    checkpoint: str,
    *,
    steps: int = 25,
    cfg: float = 6.0,
) -> SafePromptBundle:
    prefix = "high quality photograph, well composed, "
    return SafePromptBundle(
        positive=enhance_positive(f"{prefix}{prompt}"),
        negative=build_negative(),
        steps=steps,
        cfg=suggest_cfg(checkpoint, cfg),
    )