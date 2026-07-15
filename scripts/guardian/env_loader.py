"""Load project .env into os.environ (delegates to monster_ai.env_file)."""
from __future__ import annotations

import os
from pathlib import Path

from monster_ai.env_file import DEFAULT_ENV, load_dotenv, parse_env_file

ROOT = Path(__file__).resolve().parent.parent.parent


def load_env(
    path: Path | None = None,
    *,
    overwrite: bool = False,
) -> dict[str, str]:
    env_path = path or DEFAULT_ENV
    parsed = parse_env_file(env_path)
    load_dotenv(env_path, overwrite=overwrite)
    return parsed


def tunnel_fallback() -> str:
    tunnel_file = ROOT / "data" / "guardian-ai" / "tunnel_url.txt"
    if not tunnel_file.is_file():
        return ""
    return tunnel_file.read_text(encoding="utf-8").strip().rstrip("/")