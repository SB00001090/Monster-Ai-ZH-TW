"""Dynamic Windows outbound firewall lock via PowerShell/netsh."""
from __future__ import annotations

import json
import logging
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

RULE_PREFIX = "MonsterAI-CrimeGuard"
LOCK_STATE_FILE = "network_lock_state.json"


@dataclass
class LockResult:
    success: bool
    mode: str
    message: str
    rules_created: list[str]

    def to_dict(self) -> dict[str, Any]:
        return {
            "success": self.success,
            "mode": self.mode,
            "message": self.message,
            "rules_created": self.rules_created,
        }


def _run_ps_file(script_path: Path, *args: str) -> tuple[int, str, str]:
    cmd = [
        "powershell",
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        str(script_path),
        *args,
    ]
    try:
        r = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=60,
            creationflags=0x08000000 if sys.platform == "win32" else 0,
        )
        return r.returncode, r.stdout or "", r.stderr or ""
    except Exception as exc:  # noqa: BLE001
        return 1, "", str(exc)


def apply_network_lock(
    data_dir: Path,
    *,
    mode: str = "localhost_only",
    allow_local_services: bool = True,
) -> LockResult:
    """Apply outbound block. Requires Administrator on Windows."""
    if sys.platform != "win32":
        return LockResult(False, mode, "network_lock: platform_unsupported (Windows only)", [])
    scripts = Path(__file__).resolve().parent.parent.parent.parent / "scripts" / "crimeguard"
    ps_script = scripts / "network_lock.ps1"
    if not ps_script.exists():
        return LockResult(False, mode, "network_lock.ps1 missing", [])

    code, out, err = _run_ps_file(
        ps_script,
        "-Action",
        "lock",
        "-Mode",
        mode,
        "-AllowLocalServices",
        str(allow_local_services).lower(),
    )
    rules: list[str] = []
    try:
        for line in out.splitlines():
            if line.startswith("RULE:"):
                rules.append(line[5:].strip())
    except Exception:  # noqa: BLE001
        pass

    success = code == 0
    state = {
        "locked": success,
        "mode": mode,
        "locked_at": time.time(),
        "rules": rules,
    }
    data_dir.mkdir(parents=True, exist_ok=True)
    (data_dir / LOCK_STATE_FILE).write_text(json.dumps(state, indent=2), encoding="utf-8")

    msg = "Network locked" if success else f"Lock failed: {err or out}"
    if not success and "access" in (err + out).lower():
        msg = "需要管理員權限才能套用防火牆鎖定"
    return LockResult(success, mode, msg, rules)


def release_network_lock(
    data_dir: Path,
    *,
    confirm_token: str,
    expected_token: str,
) -> LockResult:
    """Emergency recovery — requires matching confirm token."""
    if confirm_token != expected_token:
        return LockResult(False, "release", "Recovery token mismatch — denied", [])

    scripts = Path(__file__).resolve().parent.parent.parent.parent / "scripts" / "crimeguard"
    ps_script = scripts / "network_lock.ps1"
    code, out, err = _run_ps_file(ps_script, "-Action", "unlock", "-ConfirmToken", confirm_token)

    success = code == 0
    state_path = data_dir / LOCK_STATE_FILE
    if success and state_path.exists():
        state_path.unlink(missing_ok=True)

    return LockResult(
        success,
        "release",
        "Network unlocked" if success else f"Unlock failed: {err or out}",
        [],
    )


def is_network_locked(data_dir: Path) -> bool:
    state_path = data_dir / LOCK_STATE_FILE
    if not state_path.exists():
        return False
    try:
        return bool(json.loads(state_path.read_text(encoding="utf-8")).get("locked"))
    except (OSError, json.JSONDecodeError):
        return False


def load_lock_state(data_dir: Path) -> dict[str, Any]:
    state_path = data_dir / LOCK_STATE_FILE
    if not state_path.exists():
        return {"locked": False}
    try:
        return json.loads(state_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"locked": False}