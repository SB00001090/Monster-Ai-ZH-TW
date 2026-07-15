"""Parse project .env into os.environ (no external deps)."""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_ENV = ROOT / ".env"


def parse_env_file(path: Path) -> dict[str, str]:
    if not path.is_file():
        return {}
    out: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].strip()
        if "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key:
            out[key] = val
    return out


def load_dotenv(
    path: Path | None = None,
    *,
    overwrite: bool = False,
) -> int:
    """Apply .env to os.environ. Returns number of keys applied."""
    env_path = path or DEFAULT_ENV
    applied = 0
    for key, val in parse_env_file(env_path).items():
        if overwrite or not os.environ.get(key):
            os.environ[key] = val
            applied += 1
    return applied