"""Encrypt LoRA, workflows, and sensitive assets with hardware-bound AES-256."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

from monster_ai.protection.monsterlock.crypto import encrypt_file, is_encrypted_file
from monster_ai.protection.monsterlock.hardware import collect_hardware_profile
from monster_ai.protection.monsterlock.key_vault import RuntimeKeyVault
from monster_ai.protection.monsterlock.layered_crypto import encrypt_file_layered, is_layered_file

ASSET_EXTENSIONS = {".safetensors", ".pt", ".json", ".yaml", ".yml", ".py"}


def collect_files(base: Path) -> list[Path]:
    if not base.exists():
        return []
    files: list[Path] = []
    for p in base.rglob("*"):
        if p.is_file() and p.suffix.lower() in ASSET_EXTENSIONS:
            if not p.name.endswith((".mlck", ".mlck3")) and not is_encrypted_file(p) and not is_layered_file(p):
                files.append(p)
    return files


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--all", action="store_true", help="Encrypt default asset dirs")
    parser.add_argument("--layered", action="store_true", help="Use v3 layered encryption (large models)")
    parser.add_argument("paths", nargs="*", help="Specific files or directories")
    args = parser.parse_args()

    profile = collect_hardware_profile(bind_gpu=True)
    fp = profile.fingerprint
    data_dir = ROOT / "data" / "monsterlock"
    vault = RuntimeKeyVault(fp, data_dir)
    master = vault.derive_master_key()
    session = vault.rotate_session_key()

    targets: list[Path] = []
    if args.all:
        for rel in ("data/models/lora", "data/workflows", "data/models/checkpoints"):
            targets.extend(collect_files(ROOT / rel))
    for raw in args.paths:
        p = Path(raw)
        if not p.is_absolute():
            p = ROOT / p
        if p.is_dir():
            targets.extend(collect_files(p))
        elif p.is_file():
            targets.append(p)

    if not targets:
        print("No files to encrypt.")
        return 0

    count = 0
    for src in targets:
        use_layered = args.layered or src.stat().st_size > 4 * 1024 * 1024
        if use_layered:
            dst = src.with_suffix(src.suffix + ".mlck3")
            encrypt_file_layered(src, dst, master, session)
        else:
            dst = src.with_suffix(src.suffix + ".mlck")
            encrypt_file(src, dst, fp)
        src.unlink()
        count += 1
        print(f"Encrypted: {src.name} -> {dst.name}")
    vault.wipe_all()

    print(f"\n[OK] Encrypted {count} files with fingerprint {profile.short_id()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())