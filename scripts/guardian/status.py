#!/usr/bin/env python3
"""Guardian Ai one-screen status — backend, tunnel, APK, adb, last verify."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

DATA = ROOT / "data" / "guardian-ai"
REPORT = DATA / "auto_start_report.json"
TUNNEL = DATA / "tunnel_url.txt"


def _health() -> dict:
    from scripts.guardian.smoke_tunnel import _check_live_server

    return _check_live_server("http://127.0.0.1:7860", retries=1, delay_s=0.0)


def _node_api_ok() -> bool:
    sys.path.insert(0, str(ROOT / "scripts"))
    from launcher import _probe_node_api  # noqa: E402

    return _probe_node_api(3000)


def _adb_devices() -> list[str]:
    adb = Path.home() / "AppData/Local/Android/Sdk/platform-tools/adb.exe"
    if not adb.is_file():
        return []
    try:
        r = subprocess.run(
            [str(adb), "devices"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=10,
        )
        return [
            line.split()[0]
            for line in (r.stdout or "").splitlines()
            if "\tdevice" in line
        ]
    except (subprocess.TimeoutExpired, OSError):
        return []


def _apk() -> str | None:
    for name in ("guardian-ai-android-release.apk", "guardian-ai-android-debug.apk"):
        p = ROOT / "dist" / name
        if p.is_file():
            return str(p.relative_to(ROOT)).replace("\\", "/")
    return None


def _aab() -> str | None:
    p = ROOT / "dist" / "guardian-ai-android-release.aab"
    if p.is_file():
        return str(p.relative_to(ROOT)).replace("\\", "/")
    return None


def _env_summary() -> dict[str, object]:
    from scripts.guardian.env_loader import load_env, tunnel_fallback

    load_env()
    url = tunnel_fallback()
    if url:
        import os

        for key in ("GUARDIAN_TUNNEL_URL", "MONSTER_TUNNEL_URL"):
            if not os.environ.get(key):
                os.environ[key] = url

    from scripts.guardian.check_env import CHECKS

    import os

    missing = [k for k, _ in CHECKS if not (os.environ.get(k) or "").strip()]
    return {
        "integration_vars_set": len(CHECKS) - len(missing),
        "integration_vars_total": len(CHECKS),
        "missing": missing,
        "release_keystore": (ROOT / "apps" / "guardian-ai-android" / "keystore" / "guardian-ai.jks").is_file(),
    }


def main() -> int:
    print("Guardian Ai status")
    print("Developed by Suckbob | Guardian Ai")
    print("=" * 60)

    health = _health()
    tunnel = TUNNEL.read_text(encoding="utf-8").strip() if TUNNEL.is_file() else ""
    report: dict = {}
    if REPORT.is_file():
        try:
            report = json.loads(REPORT.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            pass

    verify_ok = (report.get("steps") or {}).get("verify_launch", {}).get("ok")
    lines = {
        "backend_7860": health.get("reachable"),
        "node_api_3000": _node_api_ok(),
        "tunnel_url": tunnel or None,
        "tunnel_probe_last": (report.get("steps") or {}).get("tunnel", {}).get("tunnel_probe_ok"),
        "last_verify_ok": verify_ok,
        "apk": _apk(),
        "aab": _aab(),
        "adb_devices": _adb_devices(),
        "cloudflared_pid": (DATA / "cloudflared.pid").read_text(encoding="utf-8").strip()
        if (DATA / "cloudflared.pid").is_file()
        else None,
        "integrations": _env_summary(),
    }
    print(json.dumps(lines, ensure_ascii=False, indent=2))

    if not health.get("reachable"):
        print("\n[WARN] Backend down — run: auto-guardian.bat")
        return 1
    if not lines["node_api_3000"]:
        print("\n[WARN] Node API down — run: start-node-api.bat (or run.bat for full stack)")
        return 1
    if not _adb_devices():
        print("\n[INFO] No USB device — use Tunnel URL on phone, or connect USB + install-apk-adb.bat")
    print("\n[OK] Guardian Ai operational.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())