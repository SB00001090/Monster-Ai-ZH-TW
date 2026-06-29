"""Device contact detection — USB phones, Bluetooth, active outbound connections."""
from __future__ import annotations

import logging
import re
import subprocess
import sys
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

USB_PHONE_PATTERNS = re.compile(
    r"android|iphone|ipad|mobile|mtp|portable|adb|composite|qualcomm|samsung|"
    r"huawei|xiaomi|oppo|vivo|oneplus|pixel|galaxy|usb\\vid_",
    re.I,
)

BLUETOOTH_PATTERNS = re.compile(
    r"bluetooth|bth|rfcomm|hands-free|headset|audio gateway|personal area",
    re.I,
)

LOCAL_ADDR = frozenset({"127.0.0.1", "::1", "0.0.0.0", "::"})


@dataclass
class DeviceContactScanResult:
    detected: bool = False
    score: int = 0
    contact_type: str = ""
    usb_phone: bool = False
    bluetooth_active: bool = False
    active_connections: bool = False
    connection_count: int = 0
    signals: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "detected": self.detected,
            "score": self.score,
            "contact_type": self.contact_type,
            "usb_phone": self.usb_phone,
            "bluetooth_active": self.bluetooth_active,
            "active_connections": self.active_connections,
            "connection_count": self.connection_count,
            "signals": self.signals[:12],
        }


def _run_ps(script: str, timeout: float = 15.0) -> str:
    if sys.platform != "win32":
        return ""
    try:
        r = subprocess.run(
            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            creationflags=0x08000000,
        )
        return (r.stdout or "").strip()
    except Exception as exc:  # noqa: BLE001
        logger.debug("device_contact PS failed: %s", exc)
        return ""


def _scan_usb_devices() -> list[str]:
    hits: list[str] = []
    if sys.platform != "win32":
        return hits

    script = r"""
$devices = Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue |
    Where-Object { $_.Status -eq 'OK' -or $_.Status -eq 'Unknown' }
foreach ($d in $devices) {
    $blob = ($d.FriendlyName + '|' + $d.InstanceId + '|' + $d.Class).ToLower()
    if ($blob -match 'android|iphone|ipad|mtp|portable|adb|mobile|samsung|huawei|xiaomi|galaxy|pixel') {
        Write-Output ('usb:' + $d.FriendlyName)
    }
}
"""
    out = _run_ps(script)
    for line in out.splitlines():
        line = line.strip()
        if line.startswith("usb:"):
            hits.append(line)
        elif line and USB_PHONE_PATTERNS.search(line):
            hits.append(f"usb:{line}")
    return hits


def _scan_bluetooth() -> list[str]:
    hits: list[str] = []
    if sys.platform != "win32":
        return hits

    script = r"""
$bt = Get-PnpDevice -Class Bluetooth -PresentOnly -ErrorAction SilentlyContinue |
    Where-Object { $_.Status -eq 'OK' }
foreach ($d in $bt) {
    if ($d.FriendlyName -and $d.FriendlyName -notmatch 'Bluetooth Device \(Personal Area Network\)') {
        Write-Output ('bt:' + $d.FriendlyName)
    }
}
$pan = Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue |
    Where-Object { $_.FriendlyName -match 'Bluetooth' -and $_.Status -eq 'OK' }
foreach ($p in $pan) {
    Write-Output ('bt-pan:' + $p.FriendlyName)
}
"""
    out = _run_ps(script)
    seen: set[str] = set()
    for line in out.splitlines():
        line = line.strip()
        if not line or line in seen:
            continue
        seen.add(line)
        if line.startswith(("bt:", "bt-pan:")) or BLUETOOTH_PATTERNS.search(line):
            hits.append(line if ":" in line else f"bt:{line}")
    return hits[:8]


def _scan_active_connections(*, min_connections: int = 1) -> tuple[list[str], int]:
    hits: list[str] = []
    count = 0
    if sys.platform != "win32":
        return hits, count

    script = r"""
Get-NetTCPConnection -State Established -ErrorAction SilentlyContinue |
    Where-Object {
        $_.RemoteAddress -notin @('127.0.0.1','::1','0.0.0.0','::') -and
        $_.RemotePort -gt 0
    } |
    Select-Object -First 20 RemoteAddress, RemotePort, OwningProcess |
    ForEach-Object {
        Write-Output ("conn:" + $_.RemoteAddress + ":" + $_.RemotePort + ":pid" + $_.OwningProcess)
    }
"""
    out = _run_ps(script, timeout=12.0)
    for line in out.splitlines():
        line = line.strip()
        if not line.startswith("conn:"):
            continue
        parts = line[5:].rsplit(":", 2)
        if len(parts) >= 2 and parts[0] not in LOCAL_ADDR:
            count += 1
            hits.append(line)
    return hits, count


def scan_device_contact(
    *,
    require_usb_or_bt: bool = False,
    min_active_connections: int = 1,
) -> DeviceContactScanResult:
    result = DeviceContactScanResult()

    usb = _scan_usb_devices()
    bt = _scan_bluetooth()
    conns, conn_count = _scan_active_connections()

    result.signals.extend(usb)
    result.signals.extend(bt)
    result.signals.extend(conns[:10])
    result.connection_count = conn_count

    if usb:
        result.usb_phone = True
        result.score += 45
        result.contact_type = usb[0].split(":", 1)[-1][:40]
    if bt:
        result.bluetooth_active = True
        result.score += 35
        if not result.contact_type:
            result.contact_type = bt[0].split(":", 1)[-1][:40]
    if conn_count >= min_active_connections:
        result.active_connections = True
        result.score += min(30, 10 + conn_count * 2)
        if not result.contact_type:
            result.contact_type = f"tcp:{conn_count}"

    if require_usb_or_bt:
        result.detected = result.usb_phone or result.bluetooth_active
    else:
        result.detected = (
            result.usb_phone
            or result.bluetooth_active
            or result.active_connections
        )

    return result