"""List and resolve LoRA files from ComfyUI."""
from __future__ import annotations

from pathlib import Path

import httpx

def _comfyui_root() -> Path | None:
    candidates = [
        Path(__file__).resolve().parents[4] / "comfyui",
        Path("C:/MonsterAI/comfyui"),
    ]
    found = None
    for base in candidates:
        portable = base / "ComfyUI_windows_portable_nvidia" / "ComfyUI_windows_portable"
        if portable.exists():
            found = portable
            break
    if not found:
        return None
    inner = found / "ComfyUI"
    return inner if inner.exists() else found


def list_loras_from_disk() -> list[str]:
    root = _comfyui_root()
    if not root:
        return []
    lora_dir = root / "models" / "loras"
    if not lora_dir.exists():
        return []
    return sorted(
        p.name for p in lora_dir.iterdir()
        if p.suffix.lower() in {".safetensors", ".pt", ".ckpt"}
    )


async def list_loras_from_api(base_url: str) -> list[str]:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{base_url.rstrip('/')}/object_info/LoraLoader")
            if r.status_code != 200:
                return []
            data = r.json()
            loras = (
                data.get("LoraLoader", {})
                .get("input", {})
                .get("required", {})
                .get("lora_name", [[]])
            )
            if loras and isinstance(loras[0], list):
                return [x for x in loras[0] if x and x != "None"]
    except httpx.HTTPError:
        pass
    return []


async def list_loras(base_url: str) -> list[str]:
    api = await list_loras_from_api(base_url)
    if api:
        return api
    return list_loras_from_disk()


def resolve_lora(requested: str | None, available: list[str]) -> str | None:
    if not requested:
        return None
    if requested in available:
        return requested
    lower = requested.lower()
    for name in available:
        if lower in name.lower():
            return name
    return None