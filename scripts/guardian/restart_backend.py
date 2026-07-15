#!/usr/bin/env python3
"""Restart Guardian backend on :7860 — pin protected files, then main.py."""
from __future__ import annotations

import argparse
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

PYTHON = sys.executable
LOCAL = "http://127.0.0.1:7860"


def _stop_port(port: int = 7860) -> list[int]:
    killed: list[int] = []
    if sys.platform == "win32":
        r = subprocess.run(
            ["netstat", "-ano"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
        )
        for line in (r.stdout or "").splitlines():
            if f":{port}" not in line or "LISTENING" not in line:
                continue
            parts = line.split()
            if not parts:
                continue
            try:
                pid = int(parts[-1])
            except ValueError:
                continue
            if pid in killed:
                continue
            subprocess.run(["taskkill", "/PID", str(pid), "/F"], capture_output=True, check=False)
            killed.append(pid)
    return killed


def _wait_health(timeout_s: float = 120.0) -> bool:
    from scripts.guardian.smoke_tunnel import _check_live_server

    deadline = time.time() + timeout_s
    while time.time() < deadline:
        if _check_live_server(LOCAL, retries=1, delay_s=0.0).get("reachable"):
            return True
        time.sleep(2.0)
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Restart Guardian Ai backend")
    parser.add_argument("--dev", action="store_true", help="Use run_dev_server.py instead of main.py")
    parser.add_argument("--no-pin", action="store_true", help="Skip pin_protected_files")
    args = parser.parse_args()

    print("Guardian Ai restart backend")
    print("Developed by Suckbob | Guardian Ai")
    print("=" * 60)

    if not args.no_pin:
        pin = ROOT / "scripts" / "guardian" / "pin_protected_files.py"
        if pin.is_file():
            subprocess.run([PYTHON, str(pin)], cwd=str(ROOT), check=False)

    killed = _stop_port()
    if killed:
        print(f"[INFO] Stopped PIDs: {killed}")
        time.sleep(2.0)

    entry = (
        ROOT / "scripts" / "guardian" / "run_dev_server.py"
        if args.dev
        else ROOT / "main.py"
    )
    proc = subprocess.Popen(
        [PYTHON, str(entry)],
        cwd=str(ROOT),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    print(f"[INFO] Started {entry.name} pid={proc.pid}")

    if not _wait_health():
        print("[FAIL] Backend did not become healthy")
        return 1

    print(f"[OK] Backend healthy at {LOCAL}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())