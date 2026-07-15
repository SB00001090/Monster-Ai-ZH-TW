#!/usr/bin/env python3
"""Guardian Ai smoke test — API health, tunnel policy, optional live server."""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

DEV_SERVER = ROOT / "scripts" / "guardian" / "run_dev_server.py"


def _check_cloudflared() -> dict:
    from scripts.deploy_cloudflare import _find_cloudflared

    cf = _find_cloudflared()
    return {"cloudflared_found": bool(cf), "path": cf}


def _resolve_tunnel_url() -> str:
    """Prefer data/guardian-ai/tunnel_url.txt over stale process env."""
    from scripts.guardian.env_loader import load_env, tunnel_fallback

    load_env()
    file_url = tunnel_fallback()
    if file_url:
        os.environ["GUARDIAN_TUNNEL_URL"] = file_url
        if not os.environ.get("MONSTER_TUNNEL_URL"):
            os.environ["MONSTER_TUNNEL_URL"] = file_url
        return file_url
    return os.environ.get("GUARDIAN_TUNNEL_URL", "").strip()


def _check_tunnel_file() -> dict:
    path = ROOT / "data" / "guardian-ai" / "tunnel_url.txt"
    env = os.environ.get("GUARDIAN_TUNNEL_URL", "").strip()
    file_url = path.read_text(encoding="utf-8").strip().rstrip("/") if path.is_file() else ""
    active = _resolve_tunnel_url() or None
    return {
        "tunnel_file": str(path),
        "tunnel_file_exists": path.is_file(),
        "tunnel_url_file": file_url or None,
        "env_GUARDIAN_TUNNEL_URL": env or None,
        "tunnel_url_active": active,
    }


def _check_api_inprocess() -> dict:
    from fastapi.testclient import TestClient

    from monster_ai.app import create_app
    from monster_ai.config import load_settings

    settings = load_settings()
    settings.protection.monsterlock.enabled = False
    settings.protection.monsterlock.self_destruct_enabled = False
    app = create_app(settings)
    checks: dict[str, object] = {}
    with TestClient(app) as client:
        for name, path in (
            ("health", "/health"),
            ("guardian_status", "/api/guardian/status"),
            ("guardian_connection", "/api/guardian/connection"),
            ("integrations", "/api/integrations/status"),
        ):
            r = client.get(path)
            checks[name] = {"status": r.status_code, "ok": r.status_code == 200}
            if name == "guardian_status" and r.status_code == 200:
                body = r.json()
                checks["no_tailscale"] = body.get("no_tailscale")
                checks["no_qr_code"] = body.get("no_qr_code")
            if name == "guardian_connection" and r.status_code == 200:
                body = r.json()
                checks["connection_mode"] = body.get("mode")
    return checks


def _check_live_server(base: str, *, retries: int = 3, delay_s: float = 2.0) -> dict:
    try:
        import httpx
    except ImportError:
        return {"reachable": False, "reason": "httpx_missing"}

    base = base.rstrip("/")
    out: dict[str, object] = {"base": base, "reachable": False}
    last_exc: str | None = None
    for attempt in range(1, retries + 1):
        try:
            with httpx.Client(timeout=5.0) as client:
                health = client.get(f"{base}/health")
                guardian = client.get(f"{base}/api/guardian/status")
                connection = client.get(f"{base}/api/guardian/connection")
            out["reachable"] = health.status_code == 200
            out["health_status"] = health.status_code
            out["guardian_status"] = guardian.status_code
            out["connection_status"] = connection.status_code
            out["attempts"] = attempt
            if guardian.status_code == 200:
                body = guardian.json()
                out["no_tailscale"] = body.get("no_tailscale")
                out["no_qr_code"] = body.get("no_qr_code")
            if connection.status_code == 200:
                out["connection_mode"] = connection.json().get("mode")
            if out["reachable"]:
                out.pop("reason", None)
                return out
        except Exception as exc:  # noqa: BLE001
            last_exc = str(exc)
            out["reason"] = last_exc
        if attempt < retries:
            time.sleep(delay_s)
    return out


def _probe_tunnel_url(url: str) -> dict:
    return _check_live_server(url, retries=2, delay_s=1.0)


def _spawn_dev_server() -> subprocess.Popen[str] | None:
    if not DEV_SERVER.is_file():
        return None
    return subprocess.Popen(
        [sys.executable, str(DEV_SERVER)],
        cwd=str(ROOT),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        text=True,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Guardian Ai tunnel + API smoke test")
    parser.add_argument(
        "--spawn-dev",
        action="store_true",
        help="Start run_dev_server.py if localhost:7860 is down",
    )
    parser.add_argument(
        "--require-live",
        action="store_true",
        help="Fail if live server (localhost or tunnel URL) is unreachable",
    )
    args = parser.parse_args()

    print("Guardian Ai smoke test")
    print("Developed by Suckbob | Guardian Ai")
    print("=" * 60)

    dev_proc: subprocess.Popen[str] | None = None
    live_base = os.environ.get("MONSTER_API_URL") or "http://127.0.0.1:7860"
    tunnel_url = _resolve_tunnel_url()
    tunnel_info = _check_tunnel_file()

    preflight = _check_live_server(live_base, retries=1, delay_s=0.0)
    if not preflight.get("reachable") and args.spawn_dev:
        dev_proc = _spawn_dev_server()
        if dev_proc is not None:
            print("[INFO] Spawning dev server for live smoke …")
            preflight = _check_live_server(live_base, retries=15, delay_s=2.0)

    report = {
        "cloudflared": _check_cloudflared(),
        "tunnel": tunnel_info,
        "api_inprocess": _check_api_inprocess(),
        "live_server": preflight,
    }
    if tunnel_url:
        report["tunnel_probe"] = _probe_tunnel_url(tunnel_url)

    print(json.dumps(report, ensure_ascii=False, indent=2))

    api = report["api_inprocess"]
    failed = api.get("health", {}).get("ok") is not True
    if report["api_inprocess"].get("no_tailscale") is not True:
        failed = True
    if report["api_inprocess"].get("no_qr_code") is not True:
        failed = True

    if failed:
        print("\n[FAIL] In-process API checks failed.")
        if dev_proc is not None:
            dev_proc.terminate()
        return 1

    live = report["live_server"]
    if live.get("reachable"):
        print(f"\n[OK] Live server reachable at {live_base}")
    else:
        print(
            f"\n[WARN] Live server not reachable at {live_base} "
            "(try: py -3.11 scripts/guardian/run_dev_server.py)"
        )

    tunnel_probe = report.get("tunnel_probe")
    if isinstance(tunnel_probe, dict) and tunnel_probe.get("reachable"):
        print(f"[OK] Tunnel URL reachable: {tunnel_url}")
    elif tunnel_url:
        print(f"[WARN] Tunnel URL not reachable: {tunnel_url}")

    if args.require_live and not live.get("reachable"):
        print("\n[FAIL] --require-live set but server unreachable.")
        if dev_proc is not None:
            dev_proc.terminate()
        return 1

    if dev_proc is not None:
        dev_proc.terminate()
        try:
            dev_proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            dev_proc.kill()

    print("[OK] Smoke test passed (in-process).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())