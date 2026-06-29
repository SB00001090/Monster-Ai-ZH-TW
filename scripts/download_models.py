#!/usr/bin/env python3
"""Download recommended models for the active GPU profile."""
from __future__ import annotations

import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent


def detect_vram_mb() -> int | None:
    try:
        r = subprocess.run(
            ["nvidia-smi", "--query-gpu=memory.total", "--format=csv,noheader,nounits"],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
        if r.returncode == 0 and r.stdout.strip():
            return int(r.stdout.strip().split("\n")[0])
    except (FileNotFoundError, ValueError, subprocess.TimeoutExpired):
        pass
    return None


def pick_profile(vram_mb: int | None) -> str:
    env = os.getenv("MONSTER_GPU_PROFILE", "").lower()
    if env:
        return env
    if vram_mb is None:
        return "default"
    if vram_mb <= 10240:
        return "rtx_4060"
    return "rtx_4090"


def comfyui_checkpoint_dir() -> Path | None:
    sys.path.insert(0, str(ROOT / "scripts"))
    from detect_comfyui import find_comfyui

    base = find_comfyui()
    if not base:
        return None
    inner = base / "ComfyUI" if (base / "ComfyUI").exists() else base
    ckpt = inner / "models" / "checkpoints"
    ckpt.mkdir(parents=True, exist_ok=True)
    return ckpt


def download_checkpoint(repo: str, filename: str, dest_dir: Path) -> Path:
    dest = dest_dir / filename
    if dest.exists():
        print(f"Skip existing checkpoint: {dest}")
        return dest
    from huggingface_hub import hf_hub_download
    import shutil

    cached = hf_hub_download(repo, filename)
    shutil.copy(cached, dest)
    print(f"Downloaded checkpoint: {dest}")
    return dest


def pull_ollama(model: str) -> bool:
    print(f"ollama pull {model}")
    r = subprocess.run(["ollama", "pull", model], check=False)
    return r.returncode == 0


def main() -> int:
    manifest_path = ROOT / "data" / "models" / "manifest.yaml"
    if not manifest_path.exists():
        print(f"Missing manifest: {manifest_path}")
        return 1
    manifest = yaml.safe_load(manifest_path.read_text(encoding="utf-8"))
    profile = pick_profile(detect_vram_mb())
    spec = manifest.get("profiles", {}).get(profile) or manifest["profiles"]["default"]
    report: dict = {"profile": profile, "started_at": datetime.now(timezone.utc).isoformat(), "items": []}

    ckpt_dir = comfyui_checkpoint_dir()
    if ckpt_dir:
        for item in spec.get("checkpoints", []):
            try:
                path = download_checkpoint(item["repo"], item["file"], ckpt_dir)
                report["items"].append({"type": "checkpoint", "path": str(path), "ok": True})
            except Exception as exc:  # noqa: BLE001
                report["items"].append({"type": "checkpoint", "error": str(exc), "ok": False})
    else:
        report["items"].append({"type": "checkpoint", "error": "ComfyUI not found", "ok": False})

    for model in spec.get("ollama", []):
        ok = pull_ollama(model)
        report["items"].append({"type": "ollama", "model": model, "ok": ok})

    log_dir = ROOT / "data" / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    (log_dir / "model_download.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())