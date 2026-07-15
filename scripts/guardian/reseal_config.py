#!/usr/bin/env python3
"""Re-seal config.yaml after legitimate Guardian edits — clears config_modified baseline."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

from monster_ai.protection.monsterlock.behavior_monitor import save_config_baseline
from monster_ai.protection.monsterlock.config_guard import create_config_seal


def main() -> int:
    config_path = ROOT / "config.yaml"
    data_dir = ROOT / "data" / "monsterlock"
    if not config_path.is_file():
        print(f"[FAIL] Missing {config_path}")
        return 1
    create_config_seal(config_path, data_dir)
    save_config_baseline(ROOT, data_dir / "config_baseline.json")
    print("[OK] Config seal + baseline updated")
    print("Developed by Suckbob | Guardian Ai")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())