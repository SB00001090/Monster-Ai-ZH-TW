"""AnimateDiff video generation via ComfyUI (with plugin detection)."""
from __future__ import annotations

import copy
import json
import random
from pathlib import Path
from typing import Any

import httpx

from monster_ai.modules.image.checkpoint_resolver import is_sdxl_checkpoint
from monster_ai.modules.image.comfyui import ComfyUIClient


def _workflows_dir() -> Path:
    return Path(__file__).resolve().parent / "workflows"


async def has_animatediff(client: ComfyUIClient) -> bool:
    try:
        async with httpx.AsyncClient(timeout=10) as http:
            r = await http.get(f"{client.base}/object_info")
            if r.status_code != 200:
                return False
            keys = r.json().keys()
            markers = ("AnimateDiffLoader", "ADE_LoadAnimateDiffModel", "AnimateDiffModuleLoader")
            return any(m in keys for m in markers)
    except httpx.HTTPError:
        return False


def build_animatediff_workflow(
    *,
    positive: str,
    negative: str,
    checkpoint: str,
    frames: int,
    width: int,
    height: int,
    steps: int,
    cfg: float,
) -> dict[str, Any]:
    path = _workflows_dir() / "animatediff_sd15_lowvram.json"
    wf = copy.deepcopy(json.loads(path.read_text(encoding="utf-8")))
    wf["4"]["inputs"]["ckpt_name"] = checkpoint
    wf["5"]["inputs"]["width"] = width
    wf["5"]["inputs"]["height"] = height
    wf["5"]["inputs"]["batch_size"] = frames
    wf["6"]["inputs"]["text"] = positive
    wf["7"]["inputs"]["text"] = negative
    wf["3"]["inputs"]["seed"] = random.randint(0, 2**32 - 1)
    wf["3"]["inputs"]["steps"] = steps
    wf["3"]["inputs"]["cfg"] = cfg
    if is_sdxl_checkpoint(checkpoint):
        wf["5"]["inputs"]["width"] = min(width, 768)
        wf["5"]["inputs"]["height"] = min(height, 768)
    return wf


async def run_animatediff(
    client: ComfyUIClient,
    workflow: dict[str, Any],
    output_dir: Path,
) -> Path:
    prompt_id = await client.queue_prompt(workflow)
    images = await client.wait_for_images(prompt_id, max_wait=300)
    import uuid

    out = output_dir / f"{uuid.uuid4().hex}.png"
    await client.download_image(images[0], out)
    return out