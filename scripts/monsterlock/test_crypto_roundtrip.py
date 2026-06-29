"""Quick AES-256 roundtrip test for MonsterLock."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

from monster_ai.protection.monsterlock.crypto import decrypt_bytes, encrypt_bytes
from monster_ai.protection.monsterlock.hardware import collect_hardware_profile


def main() -> int:
    fp = collect_hardware_profile().fingerprint
    plain = b"MonsterLock test payload"
    enc = encrypt_bytes(plain, fp)
    dec = decrypt_bytes(enc, fp)
    assert dec == plain, "decrypt mismatch"
    print("[OK] AES-256 roundtrip passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())