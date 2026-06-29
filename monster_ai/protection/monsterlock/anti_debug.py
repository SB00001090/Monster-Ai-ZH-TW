"""Anti-debug, anti-VM, anti-sandbox detection for MonsterLock."""
from __future__ import annotations

import ctypes
import logging
import os
import subprocess
import sys
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

SUSPICIOUS_PROCESSES = frozenset(
    {
        "x64dbg",
        "x32dbg",
        "ollydbg",
        "ida64",
        "ida",
        "idaq",
        "windbg",
        "immunitydebugger",
        "cheatengine",
        "processhacker",
        "procmon",
        "procmon64",
        "wireshark",
        "fiddler",
        "dnspy",
        "ghidra",
        "pestudio",
        "vboxservice",
        "vboxtray",
        "vmwaretray",
        "vmwareuser",
        "vmtoolsd",
        "sandboxie",
        "sbiesvc",
        "pythonw.exe",  # only flagged in strict mode with parent analysis
    }
)

VM_INDICATORS = (
    "vmware",
    "virtualbox",
    "vbox",
    "qemu",
    "xen",
    "hyper-v",
    "parallels",
    "virtual machine",
)


@dataclass
class ThreatScanResult:
    threats: list[str] = field(default_factory=list)
    score: int = 0
    should_block: bool = False
    should_deceive: bool = False

    def to_dict(self) -> dict:
        return {
            "threats": self.threats,
            "score": self.score,
            "should_block": self.should_block,
            "should_deceive": self.should_deceive,
        }


def _is_debugger_present() -> bool:
    if sys.platform != "win32":
        return False
    try:
        kernel32 = ctypes.windll.kernel32  # type: ignore[attr-defined]
        return bool(kernel32.IsDebuggerPresent())
    except Exception:  # noqa: BLE001
        return False


def _check_remote_debugger() -> bool:
    if sys.platform != "win32":
        return False
    try:
        kernel32 = ctypes.windll.kernel32  # type: ignore[attr-defined]
        is_debugged = ctypes.c_int(0)
        kernel32.CheckRemoteDebuggerPresent(
            kernel32.GetCurrentProcess(),
            ctypes.byref(is_debugged),
        )
        return bool(is_debugged.value)
    except Exception:  # noqa: BLE001
        return False


def _list_process_names() -> set[str]:
    names: set[str] = set()
    if sys.platform == "win32":
        try:
            out = subprocess.run(
                ["tasklist", "/FO", "CSV", "/NH"],
                capture_output=True,
                text=True,
                timeout=8,
                creationflags=0x08000000,
            )
            for line in (out.stdout or "").splitlines():
                if not line.strip():
                    continue
                part = line.split(",")[0].strip().strip('"')
                if part:
                    names.add(part.lower())
        except Exception:  # noqa: BLE001
            pass
    else:
        try:
            out = subprocess.run(["ps", "-eo", "comm"], capture_output=True, text=True, timeout=5)
            for line in (out.stdout or "").splitlines()[1:]:
                names.add(line.strip().lower())
        except Exception:  # noqa: BLE001
            pass
    return names


def _detect_vm() -> list[str]:
    hits: list[str] = []
    if sys.platform == "win32":
        try:
            out = subprocess.run(
                [
                    "powershell",
                    "-NoProfile",
                    "-Command",
                    "(Get-CimInstance Win32_ComputerSystem).Model,(Get-CimInstance Win32_BIOS).SerialNumber -join '|'",
                ],
                capture_output=True,
                text=True,
                timeout=10,
                creationflags=0x08000000,
            )
            blob = (out.stdout or "").lower()
            for indicator in VM_INDICATORS:
                if indicator in blob:
                    hits.append(f"vm_indicator:{indicator}")
        except Exception:  # noqa: BLE001
            pass
    else:
        try:
            with open("/sys/class/dmi/id/product_name", encoding="utf-8") as f:
                blob = f.read().lower()
            for indicator in VM_INDICATORS:
                if indicator in blob:
                    hits.append(f"vm_indicator:{indicator}")
        except OSError:
            pass
    return hits


def _detect_sandbox() -> list[str]:
    hits: list[str] = []
    if os.getenv("MONSTERLOCK_ALLOW_VM", "").lower() in {"1", "true", "yes"}:
        return hits
    # Low resource sandbox heuristics
    try:
        import multiprocessing

        if multiprocessing.cpu_count() <= 2:
            hits.append("low_cpu_count")
    except Exception:  # noqa: BLE001
        pass
    if sys.platform == "win32":
        try:
            import ctypes.wintypes as wt

            class MEMORYSTATUSEX(ctypes.Structure):
                _fields_ = [
                    ("dwLength", wt.DWORD),
                    ("dwMemoryLoad", wt.DWORD),
                    ("ullTotalPhys", ctypes.c_ulonglong),
                    ("ullAvailPhys", ctypes.c_ulonglong),
                    ("ullTotalPageFile", ctypes.c_ulonglong),
                    ("ullAvailPageFile", ctypes.c_ulonglong),
                    ("ullTotalVirtual", ctypes.c_ulonglong),
                    ("ullAvailVirtual", ctypes.c_ulonglong),
                    ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
                ]

            stat = MEMORYSTATUSEX()
            stat.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
            ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat))  # type: ignore[attr-defined]
            gb = stat.ullTotalPhys / (1024**3)
            if gb < 8:
                hits.append("low_ram")
        except Exception:  # noqa: BLE001
            pass
    return hits


def scan_environment(*, strength: str = "standard", block_threshold: int = 60) -> ThreatScanResult:
    """Scan for analysis / VM / debugger threats."""
    result = ThreatScanResult()
    if _is_debugger_present():
        result.threats.append("debugger_present")
        result.score += 50
    if _check_remote_debugger():
        result.threats.append("remote_debugger")
        result.score += 40

    procs = _list_process_names()
    for proc in procs:
        base = proc.replace(".exe", "")
        if base in SUSPICIOUS_PROCESSES or proc in SUSPICIOUS_PROCESSES:
            result.threats.append(f"suspicious_process:{proc}")
            result.score += 25

    if strength in {"standard", "strict"}:
        result.threats.extend(_detect_vm())
        result.score += 15 * len([t for t in result.threats if t.startswith("vm_indicator")])

    if strength == "strict":
        result.threats.extend(_detect_sandbox())
        result.score += 10 * len([t for t in result.threats if t.startswith(("low_", "sandbox"))])

    result.should_block = result.score >= block_threshold
    result.should_deceive = result.should_block and strength == "strict"
    return result