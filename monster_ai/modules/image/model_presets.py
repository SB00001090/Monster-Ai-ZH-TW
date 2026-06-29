"""Image generation style presets — map UI choices to checkpoints and prompt tags."""
from __future__ import annotations

from dataclasses import dataclass

from monster_ai.modules.image.checkpoint_resolver import AUTO, resolve_checkpoint


@dataclass(frozen=True)
class ModelPreset:
    id: str
    label: str
    label_zh: str
    description: str
    checkpoint_hints: tuple[str, ...]
    prompt_prefix: str = ""
    prompt_suffix: str = ""
    negative_extra: str = ""
    width: int | None = None
    height: int | None = None


PRESETS: tuple[ModelPreset, ...] = (
    ModelPreset(
        id="auto",
        label="Auto",
        label_zh="自動",
        description="Use config.yaml default checkpoint",
        checkpoint_hints=(AUTO,),
    ),
    ModelPreset(
        id="realistic",
        label="Realistic",
        label_zh="寫實風",
        description="Photorealistic SDXL (cyberrealistic etc.)",
        checkpoint_hints=("cyberrealistic", "realistic", "sdxl", "photo"),
        prompt_prefix="photorealistic, highly detailed photograph, ",
        prompt_suffix="8k uhd, natural lighting",
        width=1024,
        height=1024,
    ),
    ModelPreset(
        id="anime",
        label="Anime",
        label_zh="動漫風",
        description="Anime illustration style (SD 1.5)",
        checkpoint_hints=("counterfeit", "anime", "anything", "dreamshaper", "v1-5", "sd15", "1.5", "pruned"),
        prompt_prefix="anime style, illustration, vibrant colors, detailed anime art, ",
        prompt_suffix="masterpiece, best quality",
        negative_extra="realistic photo, 3d render, photograph, ugly, bad anatomy",
        width=512,
        height=512,
    ),
    ModelPreset(
        id="sd15",
        label="SD 1.5",
        label_zh="通用 SD1.5",
        description="Stable Diffusion 1.5 general purpose",
        checkpoint_hints=("v1-5", "sd15", "1.5", "pruned", "sd_v1"),
        width=512,
        height=512,
    ),
)


def get_preset(preset_id: str | None) -> ModelPreset:
    if not preset_id:
        return PRESETS[0]
    for preset in PRESETS:
        if preset.id == preset_id:
            return preset
    return PRESETS[0]


def match_checkpoint(preset: ModelPreset, available: list[str]) -> str | None:
    if preset.id == "auto":
        return None
    for hint in preset.checkpoint_hints:
        hint_l = hint.lower()
        if hint_l == AUTO:
            continue
        for name in available:
            if hint_l in name.lower():
                return name
    return None


def resolve_style_preset(
    preset_id: str,
    available: list[str],
    *,
    config_default: str = AUTO,
) -> tuple[str, ModelPreset, str | None]:
    """Return (checkpoint, preset, warning)."""
    preset = get_preset(preset_id)
    if preset.id == "auto":
        ckpt, warn = resolve_checkpoint(config_default, available)
        return ckpt, preset, warn

    matched = match_checkpoint(preset, available)
    if matched:
        return matched, preset, None

    ckpt, warn = resolve_checkpoint(config_default, available)
    warning = (
        f"Style '{preset.label_zh}' checkpoint not installed; using '{ckpt}'. "
        f"Add a matching .safetensors to ComfyUI/models/checkpoints/"
    )
    if warn:
        warning = f"{warning} ({warn})"
    return ckpt, preset, warning


def apply_style_to_prompt(prompt: str, preset: ModelPreset) -> str:
    if preset.id == "auto":
        return prompt
    text = prompt
    if preset.prompt_prefix and not text.lower().startswith(preset.prompt_prefix[:12].lower()):
        text = f"{preset.prompt_prefix}{text}"
    if preset.prompt_suffix and preset.prompt_suffix.lower() not in text.lower():
        text = f"{text}, {preset.prompt_suffix}"
    return text


def apply_style_to_negative(negative: str, preset: ModelPreset) -> str:
    if not preset.negative_extra:
        return negative
    extra = preset.negative_extra
    if extra.lower() in negative.lower():
        return negative
    return f"{negative}, {extra}" if negative else extra


def list_presets_for_api(available: list[str], *, config_default: str = AUTO) -> list[dict]:
    items: list[dict] = []
    for preset in PRESETS:
        if preset.id == "auto":
            ckpt, _ = resolve_checkpoint(config_default, available) if available else (None, None)
            items.append(
                {
                    "id": preset.id,
                    "label": preset.label,
                    "label_zh": preset.label_zh,
                    "description": preset.description,
                    "checkpoint": ckpt,
                    "available": bool(available),
                }
            )
            continue
        matched = match_checkpoint(preset, available)
        items.append(
            {
                "id": preset.id,
                "label": preset.label,
                "label_zh": preset.label_zh,
                "description": preset.description,
                "checkpoint": matched,
                "available": matched is not None,
            }
        )
    return items