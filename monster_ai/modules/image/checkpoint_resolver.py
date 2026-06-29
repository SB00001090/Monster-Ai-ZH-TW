"""Resolve ComfyUI checkpoint names with auto fallback."""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

AUTO = "auto"


def is_sdxl_checkpoint(name: str) -> bool:
    lower = name.lower()
    return any(k in lower for k in ("sdxl", "xl", "1024", "cyberrealistic"))


def resolve_checkpoint(requested: str, available: list[str]) -> tuple[str, str | None]:
    """Return (active_checkpoint, warning_message)."""
    if not available:
        raise RuntimeError(
            "No checkpoint in ComfyUI. Add a .safetensors file to "
            "ComfyUI/models/checkpoints/ then restart ComfyUI."
        )

    req = (requested or AUTO).strip()
    if req.lower() == AUTO:
        active = available[0]
        msg = f"checkpoint auto-selected: {active}"
        logger.info(msg)
        return active, msg if len(available) > 1 else None

    if req in available:
        return req, None

    active = available[0]
    warning = (
        f"Checkpoint '{req}' not found; using '{active}'. "
        f"Available: {', '.join(available[:5])}"
    )
    logger.warning(warning)
    return active, warning