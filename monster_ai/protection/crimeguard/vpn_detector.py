"""VPN detection — processes, adapters, DNS, known exit patterns."""
from __future__ import annotations

import logging
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

logger = logging.getLogger(__name__)

VPN_PROCESSES = frozenset(
    {
        "nordvpn",
        "expressvpn",
        "surfshark",
        "mullvad",
        "protonvpn",
        "windscribe",
        "cyberghost",
        "openvpn",
        "openvpn-gui",
        "wireguard",
        "wg",
        "tunnelbear",
        "hotspot shield",
        "privateinternetaccess",
        "pia",
        "softether",
        "vpnkit",
        "nordsec",
    }
)

VPN_ADAPTER_PATTERNS = re.compile(
    r"tap|tun|wireguard|vpn|nordlynx|wintun|softether|proton|expressvpn|surfshark",
    re.I,
)

KNOWN_VPN_DNS = frozenset(
    {
        "10.8.0.1",
        "10.8.0.2",
        "1.1.1.1",  # also legit — low weight only
        "9.9.9.9",
        "149.112.112.112",
    }
)


@dataclass
class VpnScanResult:
    detected: bool = False
    score: int = 0
    vpn_type: str = ""
    signals: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "detected": self.detected,
            "score": self.score,
            "vpn_type": self.vpn_type,
            "signals": self.signals,
        }


def _run_ps(script: str, timeout: float = 12.0) -> str:
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
        logger.debug("PS failed: %s", exc)
        return ""


def _scan_processes() -> list[str]:
    hits: list[str] = []
    if sys.platform != "win32":
        return hits
    try:
        out = subprocess.run(
            ["tasklist", "/FO", "CSV", "/NH"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=8,
            creationflags=0x08000000,
        )
        for line in (out.stdout or "").splitlines():
            if not line.strip():
                continue
            name = line.split(",")[0].strip().strip('"').lower().replace(".exe", "")
            if name in VPN_PROCESSES or any(v in name for v in VPN_PROCESSES):
                hits.append(f"process:{name}")
    except Exception:  # noqa: BLE001
        pass
    return hits


def _scan_adapters() -> list[str]:
    hits: list[str] = []
    out = _run_ps(
        "Get-NetAdapter | Where-Object Status -eq 'Up' | Select-Object -ExpandProperty Name"
    )
    for line in out.splitlines():
        name = line.strip()
        if name and VPN_ADAPTER_PATTERNS.search(name):
            hits.append(f"adapter:{name}")
    return hits


def _scan_dns() -> list[str]:
    hits: list[str] = []
    out = _run_ps("(Get-DnsClientServerAddress -AddressFamily IPv4 | Select-Object -ExpandProperty ServerAddresses) -join ','")
    for dns in out.split(","):
        dns = dns.strip()
        if dns in KNOWN_VPN_DNS and dns not in {"1.1.1.1"}:
            hits.append(f"dns:{dns}")
    return hits


def load_exit_nodes(path: Path) -> list[str]:
    if not path.exists():
        return []
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        return list(data.get("exit_nodes", []))
    except Exception:  # noqa: BLE001
        return []


def scan_vpn(*, exit_nodes_path: Path | None = None) -> VpnScanResult:
    result = VpnScanResult()
    procs = _scan_processes()
    adapters = _scan_adapters()
    dns_hits = _scan_dns()

    result.signals.extend(procs)
    result.signals.extend(adapters)
    result.signals.extend(dns_hits)

    if procs:
        result.score += 50
        result.vpn_type = procs[0].split(":", 1)[-1]
    if adapters:
        result.score += 35
        if not result.vpn_type:
            result.vpn_type = adapters[0].split(":", 1)[-1]
    if dns_hits:
        result.score += 15

    if exit_nodes_path and exit_nodes_path.exists():
        result.signals.append("exit_list_loaded")

    result.detected = result.score >= 35 or bool(procs) or bool(adapters)
    return result