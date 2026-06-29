"""Runtime configuration for the Web UI gateway."""
from __future__ import annotations

import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class WebUISettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="MONSTER_WEBUI_", extra="ignore")

    host: str = "127.0.0.1"
    port: int = 7860
    monster_api_url: str = "http://127.0.0.1:7861"
    node_api_url: str = "http://127.0.0.1:3000"
    monster_api_port: int = 7861
    node_api_port: int = 3000
    open_browser: bool = True
    auto_launch: bool = True
    log_level: str = "info"
    web_root_override: str = ""

    def apply_env(self) -> None:
        os.environ.setdefault("MONSTER_API_URL", self.monster_api_url.rstrip("/"))
        os.environ.setdefault("NODE_API_URL", self.node_api_url.rstrip("/"))


def package_dir() -> Path:
    return Path(__file__).resolve().parent


def find_monster_ai_root(explicit: str | None = None) -> Path | None:
    if explicit:
        root = Path(explicit).resolve()
        return root if _looks_like_monster_repo(root) else None
    env = os.environ.get("MONSTER_AI_ROOT", "").strip()
    if env:
        root = Path(env).resolve()
        if _looks_like_monster_repo(root):
            return root
    here = Path.cwd().resolve()
    for candidate in [here, *here.parents]:
        if _looks_like_monster_repo(candidate):
            return candidate
    return None


def _looks_like_monster_repo(path: Path) -> bool:
    return (path / "monster_ai").is_dir() and (path / "package.json").is_file()