#!/usr/bin/env python3
"""End-to-end Cloudflare quick tunnel smoke — dev server + cloudflared + HTTPS probe."""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

TUNNEL_URL_RE = re.compile(r"https://[a-z0-9-]+\.trycloudflare\.com", re.I)
TUNNEL_FILE = ROOT / "data" / "guardian-ai" / "tunnel_url.txt"
DEV_SERVER = ROOT / "scripts" / "guardian" / "run_dev_server.py"


def _find_cloudflared() -> str | None:
    from scripts.deploy_cloudflare import _find_cloudflared

    return _find_cloudflared()


def _wait_health(base: str, timeout_s: float = 60.0) -> bool:
    from scripts.guardian.smoke_tunnel import _check_live_server

    deadline = time.time() + timeout_s
    while time.time() < deadline:
        result = _check_live_server(base, retries=1, delay_s=0.0)
        if result.get("reachable"):
            return True
        time.sleep(2.0)
    return False


def _wait_tunnel_url(timeout_s: float = 90.0) -> str | None:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        if TUNNEL_FILE.is_file():
            url = TUNNEL_FILE.read_text(encoding="utf-8").strip()
            if url:
                return url.rstrip("/")
        time.sleep(1.0)
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="Guardian Ai Cloudflare tunnel E2E")
    parser.add_argument("--skip-tunnel", action="store_true", help="Only verify localhost dev server")
    args = parser.parse_args()

    print("Guardian Ai tunnel E2E")
    print("Developed by Suckbob | Guardian Ai")
    print("=" * 60)

    if TUNNEL_FILE.is_file():
        TUNNEL_FILE.unlink()

    dev_proc = subprocess.Popen(
        [sys.executable, str(DEV_SERVER)],
        cwd=str(ROOT),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    report: dict[str, object] = {"dev_server_pid": dev_proc.pid}
    cf_proc: subprocess.Popen[str] | None = None

    try:
        if not _wait_health("http://127.0.0.1:7860"):
            print("[FAIL] Dev server did not become healthy")
            return 1
        report["localhost"] = {"reachable": True}

        if args.skip_tunnel:
            print(json.dumps(report, ensure_ascii=False, indent=2))
            print("[OK] Localhost E2E passed (tunnel skipped).")
            return 0

        cf = _find_cloudflared()
        if not cf:
            print("[FAIL] cloudflared not found")
            return 1
        report["cloudflared"] = cf

        cf_proc = subprocess.Popen(
            [cf, "tunnel", "--url", "http://127.0.0.1:7860"],
            cwd=str(ROOT),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        report["cloudflared_pid"] = cf_proc.pid

        tunnel_url: str | None = None
        deadline = time.time() + 90.0
        assert cf_proc.stdout is not None
        while time.time() < deadline and tunnel_url is None:
            line = cf_proc.stdout.readline()
            if not line and cf_proc.poll() is not None:
                break
            if line:
                match = TUNNEL_URL_RE.search(line)
                if match:
                    tunnel_url = match.group(0).rstrip("/")
                    TUNNEL_FILE.parent.mkdir(parents=True, exist_ok=True)
                    TUNNEL_FILE.write_text(tunnel_url + "\n", encoding="utf-8")

        if not tunnel_url:
            print("[FAIL] Could not obtain trycloudflare.com URL")
            return 1

        time.sleep(8.0)
        from scripts.guardian.smoke_tunnel import _check_live_server

        probe = _check_live_server(tunnel_url, retries=8, delay_s=3.0)
        report["tunnel_url"] = tunnel_url
        report["tunnel_probe"] = probe
        print(json.dumps(report, ensure_ascii=False, indent=2))

        if not probe.get("reachable"):
            print(f"[FAIL] Tunnel URL not reachable: {tunnel_url}")
            return 1

        print(f"[OK] Tunnel E2E passed: {tunnel_url}")
        return 0
    finally:
        for proc in (cf_proc, dev_proc):
            if proc is not None and proc.poll() is None:
                proc.terminate()
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    proc.kill()


if __name__ == "__main__":
    raise SystemExit(main())