"""Hardware detection and tier classification for hardware-agnostic runtime."""
from __future__ import annotations

import logging
import os
import subprocess
import sys
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class HardwareProbeResult:
    tier: str = "cpu_only"
    cpu_cores: int = 1
    ram_gb: float = 4.0
    vram_mb: int = 0
    gpu_vendor: str = "none"
    gpu_name: str = ""
    has_cuda: bool = False
    has_vulkan: bool = False
    platform_name: str = "unknown"
    backends: list[str] = field(default_factory=lambda: ["rules", "ollama_q4"])

    def to_dict(self) -> dict[str, Any]:
        return {
            "tier": self.tier,
            "cpu_cores": self.cpu_cores,
            "ram_gb": round(self.ram_gb, 1),
            "vram_mb": self.vram_mb,
            "gpu_vendor": self.gpu_vendor,
            "gpu_name": self.gpu_name,
            "has_cuda": self.has_cuda,
            "has_vulkan": self.has_vulkan,
            "platform": self.platform_name,
            "backends": self.backends,
        }


def _run_cmd(cmd: list[str], timeout: float = 8.0) -> str:
    try:
        r = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            creationflags=0x08000000 if sys.platform == "win32" else 0,
        )
        return (r.stdout or "").strip()
    except Exception as exc:  # noqa: BLE001
        logger.debug("cmd failed %s: %s", cmd, exc)
        return ""


def _which(name: str) -> bool:
    from shutil import which

    return which(name) is not None


def _probe_cpu_cores() -> int:
    return os.cpu_count() or 1


def _probe_ram_gb() -> float:
    if sys.platform == "win32":
        out = _run_cmd(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                "(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory",
            ]
        )
        try:
            return int(out) / (1024**3)
        except ValueError:
            pass
    return 8.0


def _probe_vram_mb() -> tuple[int, str, str]:
    smi = _run_cmd(
        ["nvidia-smi", "--query-gpu=memory.total,name", "--format=csv,noheader,nounits"]
    )
    if smi:
        line = smi.splitlines()[0]
        parts = [p.strip() for p in line.split(",", 1)]
        if len(parts) == 2:
            try:
                return int(float(parts[0])), parts[1], "nvidia"
            except ValueError:
                pass
    if sys.platform == "win32":
        ps = _run_cmd(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                "(Get-CimInstance Win32_VideoController | Select-Object -First 1 Name, AdapterRAM | "
                "ConvertTo-Json -Compress)",
            ],
            timeout=12.0,
        )
        if ps and "Name" in ps:
            try:
                import json

                data = json.loads(ps)
                name = str(data.get("Name", ""))
                ram = int(data.get("AdapterRAM", 0) or 0)
                vram_mb = max(0, ram // (1024 * 1024))
                vendor = "nvidia" if "NVIDIA" in name.upper() else "intel"
                if 0 < vram_mb < 512:
                    vram_mb = 0
                return vram_mb, name, vendor
            except (json.JSONDecodeError, ValueError, TypeError):
                pass
    return 0, "", "none"


def _classify_tier(ram_gb: float, vram_mb: int, platform_name: str) -> str:
    if platform_name in {"android", "ios"} or ram_gb < 6:
        return "mobile"
    if vram_mb <= 0:
        return "cpu_only"
    if vram_mb <= 6144:
        return "low_vram"
    if vram_mb <= 12288:
        return "mid_vram"
    return "high_vram"


def _backends_for_tier(tier: str) -> list[str]:
    if tier == "mobile":
        return ["rules"]
    chain = ["rules", "ollama_q4"]
    if tier in {"mid_vram", "high_vram"}:
        chain.append("ollama_full")
    chain.insert(1, "llama_cpp")
    return chain


class HardwareProbe:
    def detect(self) -> HardwareProbeResult:
        plat = sys.platform
        platform_name = "windows" if plat == "win32" else ("macos" if plat == "darwin" else plat)
        cores = _probe_cpu_cores()
        ram = _probe_ram_gb()
        vram_mb, gpu_name, vendor = _probe_vram_mb()
        has_cuda = vendor == "nvidia" and _which("nvidia-smi")
        tier = _classify_tier(ram, vram_mb, platform_name)
        return HardwareProbeResult(
            tier=tier,
            cpu_cores=cores,
            ram_gb=ram,
            vram_mb=vram_mb,
            gpu_vendor=vendor,
            gpu_name=gpu_name,
            has_cuda=bool(has_cuda),
            has_vulkan=_which("vulkaninfo"),
            platform_name=platform_name,
            backends=_backends_for_tier(tier),
        )


def detect_hardware() -> HardwareProbeResult:
    return HardwareProbe().detect()