"""Build ComfyUI API workflows with injected prompts and LoRA."""
from __future__ import annotations

import copy
import json
import random
from pathlib import Path
from typing import Any

from monster_ai.modules.image.checkpoint_resolver import is_sdxl_checkpoint


def _workflows_dir() -> Path:
    return Path(__file__).resolve().parent / "workflows"


def load_workflow(name: str) -> dict[str, Any]:
    path = _workflows_dir() / f"{name}.json"
    if not path.exists():
        raise FileNotFoundError(f"Workflow not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def pick_workflow_template(checkpoint: str) -> str:
    return "sdxl_txt2img" if is_sdxl_checkpoint(checkpoint) else "sd15_txt2img"


def build_latent_upscale_txt2img_workflow(
    *,
    positive: str,
    negative: str = "low quality, blurry, bad anatomy",
    checkpoint: str,
    width: int | None = None,
    height: int | None = None,
    steps: int = 20,
    cfg: float = 7.0,
    seed: int | None = None,
    lora_name: str | None = None,
    lora_strength: float = 0.8,
    vae_name: str | None = None,
    upscale_factor: float = 1.5,
    upscale_steps: int = 18,
    upscale_denoise: float = 0.35,
) -> dict[str, Any]:
    wf = copy.deepcopy(load_workflow("latent_upscale_txt2img"))
    sdxl = True
    w = width or 1024
    h = height or 1024

    wf["4"]["inputs"]["ckpt_name"] = checkpoint
    wf["5"]["inputs"]["width"] = w
    wf["5"]["inputs"]["height"] = h
    wf["6"]["inputs"]["text"] = positive
    wf["7"]["inputs"]["text"] = negative
    seed_val = seed if seed is not None else random.randint(0, 2**32 - 1)
    wf["3"]["inputs"]["seed"] = seed_val
    wf["3"]["inputs"]["steps"] = steps
    wf["3"]["inputs"]["cfg"] = cfg
    wf["11"]["inputs"]["scale_by"] = max(1.0, min(2.0, upscale_factor))
    wf["12"]["inputs"]["seed"] = seed_val
    wf["12"]["inputs"]["steps"] = upscale_steps
    wf["12"]["inputs"]["cfg"] = max(4.0, cfg - 1.0)
    wf["12"]["inputs"]["denoise"] = upscale_denoise
    if vae_name:
        wf["13"]["inputs"]["vae_name"] = vae_name

    if lora_name:
        wf["10"]["inputs"]["lora_name"] = lora_name
        wf["10"]["inputs"]["strength_model"] = lora_strength
        wf["10"]["inputs"]["strength_clip"] = lora_strength
        wf["3"]["inputs"]["model"] = ["10", 0]
        wf["12"]["inputs"]["model"] = ["10", 0]
        wf["6"]["inputs"]["clip"] = ["10", 1]
        wf["7"]["inputs"]["clip"] = ["10", 1]
    else:
        del wf["10"]
        wf["3"]["inputs"]["model"] = ["4", 0]
        wf["12"]["inputs"]["model"] = ["4", 0]

    return wf


def build_txt2img_workflow(
    *,
    positive: str,
    negative: str = "low quality, blurry, bad anatomy",
    checkpoint: str,
    width: int | None = None,
    height: int | None = None,
    steps: int = 20,
    cfg: float = 7.0,
    seed: int | None = None,
    lora_name: str | None = None,
    lora_strength: float = 0.8,
    vae_name: str | None = None,
    workflow_template: str | None = None,
    upscale_factor: float = 1.0,
) -> dict[str, Any]:
    if workflow_template == "latent_upscale_txt2img" or upscale_factor > 1.0:
        return build_latent_upscale_txt2img_workflow(
            positive=positive,
            negative=negative,
            checkpoint=checkpoint,
            width=width,
            height=height,
            steps=steps,
            cfg=cfg,
            seed=seed,
            lora_name=lora_name,
            lora_strength=lora_strength,
            vae_name=vae_name,
            upscale_factor=max(upscale_factor, 1.25),
        )
    template = workflow_template or pick_workflow_template(checkpoint)
    wf = copy.deepcopy(load_workflow(template))
    sdxl = template == "sdxl_txt2img"
    w = width or (1024 if sdxl else 512)
    h = height or (1024 if sdxl else 512)

    wf["4"]["inputs"]["ckpt_name"] = checkpoint
    wf["5"]["inputs"]["width"] = w
    wf["5"]["inputs"]["height"] = h
    wf["6"]["inputs"]["text"] = positive
    wf["7"]["inputs"]["text"] = negative
    wf["3"]["inputs"]["seed"] = seed if seed is not None else random.randint(0, 2**32 - 1)
    wf["3"]["inputs"]["steps"] = steps
    wf["3"]["inputs"]["cfg"] = cfg

    if lora_name:
        wf["10"]["inputs"]["lora_name"] = lora_name
        wf["10"]["inputs"]["strength_model"] = lora_strength
        wf["10"]["inputs"]["strength_clip"] = lora_strength
        wf["3"]["inputs"]["model"] = ["10", 0]
        wf["6"]["inputs"]["clip"] = ["10", 1]
        wf["7"]["inputs"]["clip"] = ["10", 1]
    else:
        del wf["10"]
        wf["3"]["inputs"]["model"] = ["4", 0]

    if vae_name and "13" not in wf and template == "sdxl_txt2img":
        wf["13"] = {
            "class_type": "VAELoader",
            "inputs": {"vae_name": vae_name},
        }
        wf["8"]["inputs"]["vae"] = ["13", 0]

    return wf