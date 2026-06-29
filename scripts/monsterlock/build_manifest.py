"""Build MonsterLock integrity manifest and backup protected files."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

from monster_ai.config import load_settings
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
    profile = collect_hardware_profile(bind_gpu=settings.protection.monsterlock.bind_gpu)
    signing_key = derive_static_key(profile.fingerprint)
    paths = settings.protection.monsterlock.protected_paths or DEFAULT_PROTECTED_PATHS
    manifest = build_manifest(ROOT, paths, signing_key)
    out = ROOT / "data" / "monsterlock" / "manifest.json"
    save_manifest(out, manifest)

    backup_dir = ROOT / "data" / "monsterlock" / "backup"
    for rel in paths:
        src = ROOT / rel
        if src.is_file():
            dst = backup_dir / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_bytes(src.read_bytes())

    sig_store = SignatureStore(ROOT / "data" / "monsterlock")
    signed = sig_store.build_signed_manifest(ROOT, paths)
    signed_out = ROOT / "data" / "monsterlock" / "manifest.signed.json"
    signed_out.write_text(__import__("json").dumps(signed, indent=2), encoding="utf-8")

    print(f"[OK] Manifest: {out} ({len(manifest['entries'])} entries)")
    print(f"[OK] Signed manifest: {signed_out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())