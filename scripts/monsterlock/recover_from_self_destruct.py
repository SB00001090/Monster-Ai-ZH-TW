"""Recover MonsterLock after self-destruct (integrity mismatch / LOCKED state)."""
from __future__ import annotations

import json
import shutil
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

from monster_ai.protection.monsterlock.behavior_monitor import save_config_baseline
from monster_ai.protection.monsterlock.config_guard import create_config_seal


def restore_lora_assets() -> list[str]:
    staging = ROOT / "data" / "models" / "lora" / "_lora_staging" / "anti_collapse"
    if not staging.is_file():
        raise FileNotFoundError(f"Missing staging LoRA: {staging}")

    targets = [
        ROOT / "data" / "models" / "lora" / "anti_collapse.safetensors",
        ROOT / "data" / "models" / "lora" / "anti_collapse_new.safetensors",
        ROOT / "data" / "models" / "lora" / "anti_collapse_v4.safetensors",
        ROOT / "data" / "models" / "lora" / "anti_collapse" / "adapter_model.safetensors",
    ]
    restored: list[str] = []
    for dst in targets:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(staging, dst)
        restored.append(str(dst.relative_to(ROOT)).replace("\\", "/"))

    adapter_cfg = ROOT / "data" / "models" / "lora" / "anti_collapse" / "adapter_config.json"
    with staging.open("rb") as f:
        header_len = struct.unpack("<Q", f.read(8))[0]
        meta = json.loads(f.read(header_len))
    lora_meta_raw = meta.get("__metadata__", {}).get("lora_adapter_metadata")
    if lora_meta_raw:
        adapter_cfg.write_text(lora_meta_raw + "\n", encoding="utf-8")
        restored.append(str(adapter_cfg.relative_to(ROOT)).replace("\\", "/"))

    return restored


def clear_lock_state() -> None:
    data_dir = ROOT / "data" / "monsterlock"
    for name in ("LOCKED", "destruction.log"):
        p = data_dir / name
        if p.exists():
            p.unlink()


def rebuild_protection_state() -> None:
    from monster_ai.config import load_settings
    from monster_ai.protection.monsterlock.crypto import derive_static_key
    from monster_ai.protection.monsterlock.hardware import collect_hardware_profile
    from monster_ai.protection.monsterlock.integrity import (
        DEFAULT_PROTECTED_PATHS,
        build_manifest,
        save_manifest,
    )
    from monster_ai.protection.monsterlock.signatures import SignatureStore

    settings = load_settings()
    profile = collect_hardware_profile(bind_gpu=settings.protection.monsterlock.bind_gpu)
    signing_key = derive_static_key(profile.fingerprint)
    paths = settings.protection.monsterlock.protected_paths or DEFAULT_PROTECTED_PATHS
    data_dir = ROOT / "data" / "monsterlock"
    manifest = build_manifest(ROOT, paths, signing_key)
    save_manifest(data_dir / "manifest.json", manifest)

    backup_dir = data_dir / "backup"
    for rel in paths:
        src = ROOT / rel
        if src.is_file():
            dst = backup_dir / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_bytes(src.read_bytes())

    sig_store = SignatureStore(data_dir)
    signed = sig_store.build_signed_manifest(ROOT, paths)
    (data_dir / "manifest.signed.json").write_text(
        json.dumps(signed, indent=2), encoding="utf-8"
    )
    create_config_seal(ROOT / "config.yaml", data_dir)
    save_config_baseline(ROOT, data_dir / "config_baseline.json")


def main() -> int:
    clear_lock_state()
    restored = restore_lora_assets()
    rebuild_protection_state()
    print("[OK] Cleared LOCKED state")
    print(f"[OK] Restored {len(restored)} LoRA files")
    print("[OK] Rebuilt manifest + config seal")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())