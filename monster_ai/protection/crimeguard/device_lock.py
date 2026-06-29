"""Optional USB / Bluetooth escalation lock via PowerShell."""
from __future__ import annotations

import logging
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class DeviceLockResult:
    success: bool
    message: str
    actions: list[str]

    def to_dict(self) -> dict[str, Any]:
        return {"success": self.success, "message": self.message, "actions": self.actions}


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
            timeout=45,
            creationflags=0x08000000 if sys.platform == "win32" else 0,
        )
        return r.returncode, r.stdout or "", r.stderr or ""
    except Exception as exc:  # noqa: BLE001
        return 1, "", str(exc)


def apply_device_lock(*, lock_usb: bool = True, lock_bluetooth: bool = True) -> DeviceLockResult:
    if sys.platform != "win32":
        return DeviceLockResult(False, "Windows only", [])

    scripts = Path(__file__).resolve().parent.parent.parent.parent / "scripts" / "crimeguard"
    ps_script = scripts / "device_lock.ps1"
    if not ps_script.exists():
        return DeviceLockResult(False, "device_lock.ps1 missing", [])

    code, out, err = _run_ps_file(
        ps_script,
        "-Action",
        "lock",
        "-LockUsb",
        str(lock_usb).lower(),
        "-LockBluetooth",
        str(lock_bluetooth).lower(),
    )
    actions: list[str] = []
    for line in out.splitlines():
        if line.startswith("ACTION:"):
            actions.append(line[7:].strip())

    success = code == 0
    msg = "Device lock applied" if success else f"Device lock failed: {err or out}"
    if not success and "access" in (err + out).lower():
        msg = "需要管理員權限才能鎖定 USB/藍牙"
    return DeviceLockResult(success, msg, actions)


def release_device_lock() -> DeviceLockResult:
    if sys.platform != "win32":
        return DeviceLockResult(False, "Windows only", [])

    scripts = Path(__file__).resolve().parent.parent.parent.parent / "scripts" / "crimeguard"
    ps_script = scripts / "device_lock.ps1"
    if not ps_script.exists():
        return DeviceLockResult(False, "device_lock.ps1 missing", [])

    code, out, err = _run_ps_file(ps_script, "-Action", "unlock")
    success = code == 0
    return DeviceLockResult(
        success,
        "Device lock released" if success else f"Release failed: {err or out}",
        [],
    )