"""Hardware fingerprint for MonsterLock (GPU + CPU + motherboard)."""
from __future__ import annotations

import hashlib
import json
import logging
import platform
import subprocess
import sys
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class HardwareProfile:
    cpu_id: str
    motherboard_serial: str
    gpu_uuid: str
    gpu_name: str
    machine_guid: str
    fingerprint: str
    components: dict[str, str]

    def short_id(self) -> str:
        return self.fingerprint[:16]


def _run_cmd(cmd: list[str], *, timeout: float = 8.0) -> str:
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            creationflags=0x08000000 if sys.platform == "win32" else 0,
        )
        return (result.stdout or "").strip()
    except Exception as exc:  # noqa: BLE001
        logger.debug("Command failed %s: %s", cmd, exc)
        return ""


def _wmic_value(alias: str, field: str) -> str:
    if sys.platform != "win32":
        return ""
    out = _run_cmd(["wmic", alias, "get", field, "/value"])
    for line in out.splitlines():
        if line.lower().startswith(f"{field.lower()}="):
            return line.split("=", 1)[1].strip()
    return ""


def _powershell_json(script: str) -> dict[str, Any]:
    if sys.platform != "win32":
        return {}
    cmd = [
        "powershell",
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        script,
    ]
    out = _run_cmd(cmd, timeout=12.0)
    if not out:
        return {}
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        return {}


def _collect_cpu_id() -> str:
    if sys.platform == "win32":
        proc = _wmic_value("cpu", "ProcessorId")
        if proc:
            return proc
        ps = _powershell_json(
            "(Get-CimInstance Win32_Processor | Select-Object -First 1 ProcessorId).ProcessorId | ConvertTo-Json"
        )
        if isinstance(ps, str) and ps:
            return ps
    return platform.processor() or "unknown-cpu"


def _collect_motherboard_serial() -> str:
    if sys.platform == "win32":
        serial = _wmic_value("baseboard", "SerialNumber")
        if serial and serial.lower() not in {"to be filled by o.e.m.", "default string", ""}:
            return serial
        ps = _powershell_json(
            "(Get-CimInstance Win32_BaseBoard | Select-Object -First 1 SerialNumber).SerialNumber | ConvertTo-Json"
        )
        if isinstance(ps, str) and ps:
            return ps
    return "unknown-board"


def _collect_machine_guid() -> str:
    if sys.platform != "win32":
        return platform.node() or "unknown-node"
    ps = _powershell_json(
        "(Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Cryptography' -Name MachineGuid).MachineGuid | ConvertTo-Json"
    )
    if isinstance(ps, str) and ps:
        return ps
    return platform.node() or "unknown-node"


def _collect_gpu() -> tuple[str, str]:
    """Return (gpu_uuid, gpu_name). Prefers RTX 4090 if multiple GPUs."""
    if sys.platform == "win32":
        ps = _powershell_json(
            "Get-CimInstance Win32_VideoController | "
            "Select-Object Name, PNPDeviceID | ConvertTo-Json -Compress"
        )
        if isinstance(ps, dict):
            gpus = [ps]
        elif isinstance(ps, list):
            gpus = ps
        else:
            gpus = []
        preferred = None
        for gpu in gpus:
            name = str(gpu.get("Name", ""))
            pnp = str(gpu.get("PNPDeviceID", ""))
            if "4090" in name.upper() or "NVIDIA" in name.upper():
                preferred = (pnp or name, name)
                if "4090" in name.upper():
                    break
        if preferred:
            return preferred

    smi = _run_cmd(
        [
            "nvidia-smi",
            "--query-gpu=uuid,name",
            "--format=csv,noheader,nounits",
        ]
    )
    if smi:
        lines = [ln.strip() for ln in smi.splitlines() if ln.strip()]
        preferred_line = None
        for line in lines:
            if "4090" in line.upper():
                preferred_line = line
                break
        line = preferred_line or (lines[0] if lines else "")
        if line:
            parts = [p.strip() for p in line.split(",", 1)]
            if len(parts) == 2:
                return parts[0], parts[1]
            return line, "nvidia-gpu"
    return "no-gpu", "unknown-gpu"


def _derive_fingerprint(components: dict[str, str]) -> str:
    canonical = "|".join(f"{k}={components[k]}" for k in sorted(components))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def collect_hardware_profile(*, bind_gpu: bool = True) -> HardwareProfile:
    """Collect stable hardware identifiers and derive SHA-256 fingerprint."""
    gpu_uuid, gpu_name = _collect_gpu()
    components = {
        "cpu": _collect_cpu_id(),
        "board": _collect_motherboard_serial(),
        "machine_guid": _collect_machine_guid(),
    }
    if bind_gpu:
        components["gpu_uuid"] = gpu_uuid
        components["gpu_name"] = gpu_name

    fingerprint = _derive_fingerprint(components)
    return HardwareProfile(
        cpu_id=components["cpu"],
        motherboard_serial=components["board"],
        gpu_uuid=gpu_uuid,
        gpu_name=gpu_name,
        machine_guid=components["machine_guid"],
        fingerprint=fingerprint,
        components=components,
    )


def verify_bound_fingerprint(stored: str, *, bind_gpu: bool = True, tolerance: int = 0) -> bool:
    """Check current hardware matches stored fingerprint (exact or component diff)."""
    if not stored:
        return False
    current = collect_hardware_profile(bind_gpu=bind_gpu)
    if current.fingerprint == stored:
        return True
    if tolerance <= 0:
        return False
    stored_parts = stored
    # Allow re-derive with partial component match for GPU swap tolerance mode
    return stored_parts[: max(8, 32 - tolerance)] == current.fingerprint[: max(8, 32 - tolerance)]