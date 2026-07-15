#!/usr/bin/env python3
"""Guardian Ai dev/smoke server — MonsterLock relaxed for tunnel verification.

Use for smoke_tunnel live checks when production main.py is blocked by MonsterLock.
  py -3.11 scripts/guardian/run_dev_server.py
"""
from __future__ import annotations

import logging
import sys
from pathlib import Path

import uvicorn

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

from monster_ai.app import create_app
from monster_ai.config import load_settings


def _relaxed_settings():
    settings = load_settings()
    settings.protection.monsterlock.enabled = False
    settings.protection.monsterlock.self_destruct_enabled = False
    settings.protection.monsterlock.config_guard_enabled = False
    settings.protection.monsterlock.behavior_monitor_enabled = False
    settings.launcher.auto_start_comfyui = False
    settings.launcher.wait_for_comfyui = False
    return settings


def main() -> None:
    settings = _relaxed_settings()
    logging.basicConfig(
        level=settings.log_level.upper(),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    app = create_app(settings)
    print(f"Guardian Ai dev server → http://{settings.host}:{settings.port}")
    print("Developed by Suckbob | Guardian Ai")
    uvicorn.run(app, host=settings.host, port=settings.port, log_level=settings.log_level)


if __name__ == "__main__":
    main()