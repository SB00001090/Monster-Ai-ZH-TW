"""Config tamper guard — prevents disabling MonsterLock via yaml edits."""
from __future__ import annotations

import hashlib
import json
import logging
from pathlib import Path
from typing import Any

import yaml

from monster_ai.protection.monsterlock.hardware import collect_hardware_profile
from monster_ai.protection.monsterlock.key_vault import dpapi_protect, dpapi_unprotect

logger = logging.getLogger(__name__)

SEAL_VERSION = 2


def _canonical_ml_config(data: dict[str, Any]) -> str:
    ml = data.get("protection", {}).get("monsterlock", {})
    canonical = {
        "enabled": ml.get("enabled", True),
        "strength": ml.get("strength", "standard"),
        "hardware_binding": ml.get("hardware_binding", True),
        "bind_gpu": ml.get("bind_gpu", True),
        "self_destruct_enabled": ml.get("self_destruct_enabled", False),
        "config_guard_enabled": ml.get("config_guard_enabled", True),
        "block_on_mismatch": ml.get("block_on_mismatch", True),
    }
    return json.dumps(canonical, sort_keys=True, separators=(",", ":"))


def create_config_seal(config_path: Path, data_dir: Path) -> Path:
    """Seal critical MonsterLock config — call after legitimate config changes."""
    data_dir.mkdir(parents=True, exist_ok=True)
    seal_path = data_dir / "config.seal"
    raw = config_path.read_text(encoding="utf-8")
    data = yaml.safe_load(raw) or {}
    profile = collect_hardware_profile(bind_gpu=data.get("protection", {}).get("monsterlock", {}).get("bind_gpu", True))
    payload = _canonical_ml_config(data)
    digest = hashlib.sha256((profile.fingerprint + payload).encode()).hexdigest()
    blob = json.dumps(
        {"version": SEAL_VERSION, "fingerprint": profile.fingerprint[:16], "digest": digest, "payload": payload},
        separators=(",", ":"),
    ).encode("utf-8")
    sealed = dpapi_protect(blob, local_machine=True)
    if sealed:
        seal_path.write_bytes(sealed)
    else:
        seal_path.write_text(json.dumps({"version": SEAL_VERSION, "digest": digest, "payload": payload}), encoding="utf-8")
    logger.info("Config seal created: %s", seal_path)
    return seal_path


def verify_config_seal(config_path: Path, data_dir: Path) -> tuple[bool, str]:
    """Return (ok, reason). Fails if MonsterLock was disabled without re-sealing."""
    seal_path = data_dir / "config.seal"
    if not seal_path.exists():
        return True, "no_seal"

    raw = config_path.read_text(encoding="utf-8")
    data = yaml.safe_load(raw) or {}
    ml = data.get("protection", {}).get("monsterlock", {})
    if not ml.get("config_guard_enabled", True):
        return True, "guard_disabled"

    try:
        blob = seal_path.read_bytes()
        unwrapped = dpapi_unprotect(blob)
        if unwrapped:
            seal = json.loads(unwrapped.decode("utf-8"))
        else:
            seal = json.loads(blob.decode("utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return False, f"seal_corrupt:{exc}"

    profile = collect_hardware_profile(bind_gpu=ml.get("bind_gpu", True))
    payload = _canonical_ml_config(data)
    digest = hashlib.sha256((profile.fingerprint + payload).encode()).hexdigest()

    if seal.get("digest") != digest:
        return False, "config_tampered"

    # Block env-based disable when seal active
    import os

    if os.getenv("MONSTERLOCK_ENABLED", "").lower() in {"0", "false", "no"}:
        return False, "env_disable_blocked"

    if not ml.get("enabled", True) and seal.get("payload", "").find('"enabled": true') >= 0:
        return False, "monsterlock_disabled"

    return True, "ok"


def enforce_config_guard(config_path: Path, *, data_dir: Path, hard_fail: bool = True) -> None:
    ok, reason = verify_config_seal(config_path, data_dir)
    if ok:
        return
    msg = f"MonsterLock config guard violation: {reason}"
    logger.critical(msg)
    if hard_fail:
        raise SystemExit(msg)