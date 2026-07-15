#!/usr/bin/env python3
"""Refresh MonsterLock backup + manifest after legitimate protected-file edits."""
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

from monster_ai.config import load_settings
from monster_ai.protection.monsterlock.behavior_monitor import save_config_baseline
from monster_ai.protection.monsterlock.config_guard import create_config_seal
from monster_ai.protection.monsterlock.crypto import derive_static_key
from monster_ai.protection.monsterlock.hardware import collect_hardware_profile
from monster_ai.protection.monsterlock.integrity import (
    DEFAULT_PROTECTED_PATHS,
    build_manifest,
    save_manifest,
)
from monster_ai.protection.monsterlock.signatures import SignatureStore


def main() -> int:
    settings = load_settings()
    data_dir = ROOT / "data" / "monsterlock"
    data_dir.mkdir(parents=True, exist_ok=True)
    profile = collect_hardware_profile(bind_gpu=settings.protection.monsterlock.bind_gpu)
    signing_key = derive_static_key(profile.fingerprint)
    paths = settings.protection.monsterlock.protected_paths or DEFAULT_PROTECTED_PATHS

    copied: list[str] = []
    for rel in paths:
        src = ROOT / rel
        if not src.is_file():
            continue
        dst = data_dir / "backup" / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        copied.append(rel)

    manifest = build_manifest(ROOT, paths, signing_key)
    save_manifest(data_dir / "manifest.json", manifest)

    sig_store = SignatureStore(data_dir)
    signed = sig_store.build_signed_manifest(ROOT, paths)
    (data_dir / "manifest.signed.json").write_text(
        json.dumps(signed, indent=2), encoding="utf-8"
    )

    create_config_seal(ROOT / "config.yaml", data_dir)
    save_config_baseline(ROOT, data_dir / "config_baseline.json")

    print(f"[OK] Pinned {len(copied)} protected files")
    print("Developed by Suckbob | Guardian Ai")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())