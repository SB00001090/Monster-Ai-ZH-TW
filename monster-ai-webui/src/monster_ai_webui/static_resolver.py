"""Pick React bundle or HTML fallback static root."""
from __future__ import annotations

import os
from pathlib import Path

from monster_ai_webui.config import package_dir

MODE_REACT = "react"
MODE_FALLBACK = "fallback"


def resolve_web_root(override: str = "") -> tuple[Path, str]:
    if override:
        root = Path(override).resolve()
        if root.is_dir():
            return root, "custom"
        raise FileNotFoundError(f"MONSTER_WEBUI_ROOT not found: {root}")

    env = os.environ.get("MONSTER_WEBUI_ROOT", "").strip()
    if env:
        root = Path(env).resolve()
        if root.is_dir():
            return root, "custom"

    base = package_dir() / "web"
    react = base / "react"
    fallback = base / "fallback"
    if (react / "index.html").is_file():
        return react, MODE_REACT
    if (fallback / "index.html").is_file():
        return fallback, MODE_FALLBACK
    raise FileNotFoundError(
        "No bundled UI found. Run: python monster-ai-webui/scripts/sync_assets.py"
    )