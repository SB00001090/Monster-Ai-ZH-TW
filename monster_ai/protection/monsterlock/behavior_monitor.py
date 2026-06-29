"""Behavior monitoring — process + file access anomaly detection."""
from __future__ import annotations

import json
import logging
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)

DUMP_TOOLS = frozenset(
    {
        "procdump",
        "procdump64",
        "dumpit",
        "winpmem",
        "volatility",
        "memoryze",
        "rekall",
    }
)

CONFIG_WATCH_FILES = ("config.yaml", "config.example.yaml")


@dataclass
class BehaviorReport:
    anomalies: list[str] = field(default_factory=list)
    score: int = 0

    @property
    def triggered(self) -> bool:
        return self.score >= 50


def _process_names() -> set[str]:
    names: set[str] = set()
    if sys.platform != "win32":
        return names
    try:
        out = subprocess.run(
            ["tasklist", "/FO", "CSV", "/NH"],
            capture_output=True,
            text=True,
            timeout=8,
            creationflags=0x08000000,
        )
        for line in (out.stdout or "").splitlines():
            if line.strip():
                names.add(line.split(",")[0].strip().strip('"').lower())
    except Exception:  # noqa: BLE001
        pass
    return names


def _python_debug_args() -> list[str]:
    hits: list[str] = []
    try:
        out = subprocess.run(
            ["wmic", "process", "where", "name='python.exe'", "get", "CommandLine"],
            capture_output=True,
            text=True,
            timeout=10,
            creationflags=0x08000000,
        )
        blob = (out.stdout or "").lower()
        for marker in ("debugpy", "pdb", "-m trace", "pydevd", "attach"):
            if marker in blob:
                hits.append(f"python_debug:{marker}")
    except Exception:  # noqa: BLE001
        pass
    return hits


def check_config_mtime(root: Path, *, baseline_path: Path) -> list[str]:
    hits: list[str] = []
    if not baseline_path.exists():
        return hits
    try:
        baseline = json_load(baseline_path)
        for name in CONFIG_WATCH_FILES:
            p = root / name
            if not p.exists():
                continue
            mtime = p.stat().st_mtime
            if name in baseline and abs(mtime - baseline[name]) > 1.0:
                hits.append(f"config_modified:{name}")
    except Exception:  # noqa: BLE001
        pass
    return hits


def json_load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def save_config_baseline(root: Path, baseline_path: Path) -> None:
    baseline_path.parent.mkdir(parents=True, exist_ok=True)
    data = {}
    for name in CONFIG_WATCH_FILES:
        p = root / name
        if p.exists():
            data[name] = p.stat().st_mtime
    data["saved_at"] = time.time()
    baseline_path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def scan_behavior(root: Path, baseline_path: Path) -> BehaviorReport:
    report = BehaviorReport()
    procs = _process_names()
    for proc in procs:
        base = proc.replace(".exe", "")
        if base in DUMP_TOOLS:
            report.anomalies.append(f"dump_tool:{proc}")
            report.score += 40

    report.anomalies.extend(_python_debug_args())
    report.score += 30 * len([a for a in report.anomalies if a.startswith("python_debug")])

    report.anomalies.extend(check_config_mtime(root, baseline_path=baseline_path))
    report.score += 35 * len([a for a in report.anomalies if a.startswith("config_modified")])

    return report