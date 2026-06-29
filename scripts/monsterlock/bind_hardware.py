"""Bind MonsterLock to current hardware (RTX 4090 + CPU + motherboard)."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

from monster_ai.protection.monsterlock.hardware import collect_hardware_profile


def main() -> int:
    parser = argparse.ArgumentParser(description="MonsterLock hardware binding")
    parser.add_argument("--show-only", action="store_true", dest="show_only")
    args = parser.parse_args()

    profile = collect_hardware_profile(bind_gpu=True)
    print(f"CPU ID:        {profile.cpu_id[:24]}…")
    print(f"Motherboard:   {profile.motherboard_serial[:24]}…")
    print(f"GPU:           {profile.gpu_name}")
    print(f"GPU UUID/PNP:  {profile.gpu_uuid[:40]}…")
    print(f"Fingerprint:   {profile.fingerprint}")
    print(f"Short ID:      {profile.short_id()}")

    if args.show_only:
        return 0

    out = ROOT / "data" / "monsterlock" / "hardware.binding"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps(
            {
                "fingerprint": profile.fingerprint,
                "gpu": profile.gpu_name,
                "components": profile.components,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"\n[OK] Binding saved: {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())