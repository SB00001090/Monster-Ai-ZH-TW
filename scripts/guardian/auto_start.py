#!/usr/bin/env python3
"""Guardian Ai one-click auto-start — reseal, backend, tunnel, verify.

Keeps cloudflared running in background on success.
  py -3.11 scripts/guardian/auto_start.py
  py -3.11 scripts/guardian/auto_start.py --verify   # also run smoke + pytest
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

PYTHON = sys.executable
DATA_DIR = ROOT / "data" / "guardian-ai"
TUNNEL_FILE = DATA_DIR / "tunnel_url.txt"
CF_PID_FILE = DATA_DIR / "cloudflared.pid"
REPORT_FILE = DATA_DIR / "auto_start_report.json"
TUNNEL_URL_RE = re.compile(r"https://[a-z0-9-]+\.trycloudflare\.com", re.I)
LOCAL = "http://127.0.0.1:7860"


def _run(cmd: list[str], *, check: bool = False) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        cwd=str(ROOT),
        text=True,
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        check=check,
    )


def _reseal() -> dict[str, object]:
    pin = ROOT / "scripts" / "guardian" / "pin_protected_files.py"
    if pin.is_file():
        pr = _run([PYTHON, str(pin)])
        if pr.returncode != 0:
            return {"ok": False, "reason": "pin_failed", "stderr": (pr.stderr or "").strip()}
    script = ROOT / "scripts" / "guardian" / "reseal_config.py"
    if not script.is_file():
        return {"ok": True, "pinned_only": True}
    r = _run([PYTHON, str(script)])
    return {"ok": r.returncode == 0, "stdout": (r.stdout or "").strip()}


def _is_healthy(base: str = LOCAL) -> bool:
    from scripts.guardian.smoke_tunnel import _check_live_server

    return bool(_check_live_server(base, retries=1, delay_s=0.0).get("reachable"))


def _wait_health(timeout_s: float = 90.0) -> bool:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        if _is_healthy():
            return True
        time.sleep(2.0)
    return False


def _start_node_api() -> dict[str, object]:
    """Ensure Node tRPC API on :3000 (web UI /api/trpc proxy)."""
    script = ROOT / "scripts" / "guardian" / "start_node_api.py"
    if not script.is_file():
        return {"ok": False, "reason": "start_node_api_missing"}
    r = _run([PYTHON, str(script)])
    return {
        "ok": r.returncode == 0,
        "returncode": r.returncode,
        "stdout": (r.stdout or "").strip(),
    }


def _start_backend(mode: str) -> dict[str, object]:
    if _is_healthy():
        return {"ok": True, "mode": "already_running"}

    script = (
        ROOT / "main.py"
        if mode == "main"
        else ROOT / "scripts" / "guardian" / "run_dev_server.py"
    )
    proc = subprocess.Popen(
        [PYTHON, str(script)],
        cwd=str(ROOT),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    ok = _wait_health()
    return {"ok": ok, "mode": mode, "pid": proc.pid}


def _cloudflared_running() -> int | None:
    if not CF_PID_FILE.is_file():
        return None
    try:
        pid = int(CF_PID_FILE.read_text(encoding="utf-8").strip())
    except ValueError:
        return None
    if sys.platform == "win32":
        r = _run(["tasklist", "/FI", f"PID eq {pid}", "/NH"])
        if str(pid) in (r.stdout or ""):
            return pid
        return None
    try:
        os.kill(pid, 0)
        return pid
    except OSError:
        return None


def _probe_tunnel(url: str) -> bool:
    from scripts.guardian.smoke_tunnel import _check_live_server

    result = _check_live_server(url, retries=6, delay_s=3.0)
    return bool(result.get("reachable"))


def _start_tunnel(*, force: bool) -> dict[str, object]:
    from scripts.deploy_cloudflare import _find_cloudflared

    if TUNNEL_FILE.is_file():
        existing = TUNNEL_FILE.read_text(encoding="utf-8").strip().rstrip("/")
        if existing and not force and _probe_tunnel(existing):
            return {"ok": True, "tunnel_url": existing, "reused": True}

    if TUNNEL_FILE.is_file() and force:
        TUNNEL_FILE.unlink()

    running_pid = _cloudflared_running()
    if running_pid and not force:
        url = TUNNEL_FILE.read_text(encoding="utf-8").strip().rstrip("/") if TUNNEL_FILE.is_file() else ""
        if url and _probe_tunnel(url):
            return {"ok": True, "tunnel_url": url, "cloudflared_pid": running_pid, "reused": True}

    if running_pid:
        try:
            subprocess.run(["taskkill", "/PID", str(running_pid), "/F"], capture_output=True, check=False)
        except Exception:  # noqa: BLE001
            pass
        CF_PID_FILE.unlink(missing_ok=True)

    cf = _find_cloudflared()
    if not cf:
        return {"ok": False, "reason": "cloudflared_missing"}

    proc = subprocess.Popen(
        [cf, "tunnel", "--url", LOCAL],
        cwd=str(ROOT),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    CF_PID_FILE.write_text(str(proc.pid), encoding="utf-8")

    tunnel_url: str | None = None
    deadline = time.time() + 120.0
    assert proc.stdout is not None
    while time.time() < deadline and tunnel_url is None:
        line = proc.stdout.readline()
        if not line and proc.poll() is not None:
            break
        if line:
            match = TUNNEL_URL_RE.search(line)
            if match:
                tunnel_url = match.group(0).rstrip("/")
                TUNNEL_FILE.write_text(tunnel_url + "\n", encoding="utf-8")

    if not tunnel_url:
        proc.terminate()
        CF_PID_FILE.unlink(missing_ok=True)
        return {"ok": False, "reason": "tunnel_url_timeout"}

    time.sleep(6.0)
    probed = _probe_tunnel(tunnel_url)
    os.environ["GUARDIAN_TUNNEL_URL"] = tunnel_url
    out: dict[str, object] = {
        "ok": True,
        "tunnel_url": tunnel_url,
        "cloudflared_pid": proc.pid,
        "tunnel_probe_ok": probed,
    }
    if not probed:
        out["warn"] = "tunnel_probe_failed_local_dns"
    return out


def _run_smoke() -> dict[str, object]:
    r = _run(
        [
            PYTHON,
            str(ROOT / "scripts" / "guardian" / "smoke_tunnel.py"),
            "--spawn-dev",
            "--require-live",
        ]
    )
    return {"ok": r.returncode == 0, "returncode": r.returncode}


def _run_verify() -> dict[str, object]:
    r = _run([PYTHON, str(ROOT / "scripts" / "guardian" / "verify_launch.py")])
    return {"ok": r.returncode == 0, "returncode": r.returncode}


def main() -> int:
    parser = argparse.ArgumentParser(description="Guardian Ai auto-start")
    parser.add_argument("--backend", choices=("auto", "main", "dev"), default="auto")
    parser.add_argument("--force-tunnel", action="store_true", help="Restart cloudflared")
    parser.add_argument("--skip-reseal", action="store_true")
    parser.add_argument("--verify", action="store_true", help="Run smoke_tunnel + verify_launch")
    parser.add_argument("--verify-only", action="store_true", help="Skip start; only verify")
    parser.add_argument(
        "--strict-tunnel",
        action="store_true",
        help="Fail if HTTPS tunnel probe fails (default: warn if URL + cloudflared ok)",
    )
    parser.add_argument(
        "--restart-backend",
        action="store_true",
        help="Pin + restart main.py before tunnel (loads latest firewall code)",
    )
    args = parser.parse_args()

    print("Guardian Ai auto-start")
    print("Developed by Suckbob | Guardian Ai")
    print("=" * 60)

    report: dict[str, object] = {"steps": {}}

    if not args.verify_only:
        if not args.skip_reseal:
            report["steps"]["reseal"] = _reseal()
            print(f"[{'OK' if report['steps']['reseal'].get('ok') else 'WARN'}] reseal_config")

        if args.restart_backend:
            restart = ROOT / "scripts" / "guardian" / "restart_backend.py"
            rr = _run([PYTHON, str(restart), "--no-pin"])
            report["steps"]["restart_backend"] = {
                "ok": rr.returncode == 0,
                "returncode": rr.returncode,
            }
            print(f"[{'OK' if rr.returncode == 0 else 'FAIL'}] restart_backend")

        if not _is_healthy():
            mode = args.backend
            if mode == "auto":
                mode = "main"
            report["steps"]["backend"] = _start_backend(mode)
            if not report["steps"]["backend"].get("ok") and args.backend != "dev":
                report["steps"]["backend_fallback"] = _start_backend("dev")
            backend_ok = (
                report["steps"].get("backend", {}).get("ok")
                or report["steps"].get("backend_fallback", {}).get("ok")
            )
            if not backend_ok:
                print("[FAIL] Backend did not start")
                REPORT_FILE.write_text(json.dumps(report, indent=2), encoding="utf-8")
                return 1
            print("[OK] Backend healthy at :7860")
        else:
            report["steps"]["backend"] = {"ok": True, "mode": "already_running"}
            print("[OK] Backend already running")

        report["steps"]["node_api"] = _start_node_api()
        if not report["steps"]["node_api"].get("ok"):
            print("[FAIL] Node API did not start on :3000 (see data/logs/node-api.log)")
            REPORT_FILE.write_text(json.dumps(report, indent=2), encoding="utf-8")
            return 1
        print("[OK] Node API ready on :3000")

        report["steps"]["tunnel"] = _start_tunnel(force=args.force_tunnel)
        tunnel = report["steps"]["tunnel"]
        if not tunnel.get("ok"):
            print(f"[FAIL] Tunnel: {tunnel.get('reason')}")
            REPORT_FILE.write_text(json.dumps(report, indent=2), encoding="utf-8")
            return 1
        bootstrap = ROOT / "scripts" / "guardian" / "bootstrap_env.py"
        if bootstrap.is_file() and tunnel.get("tunnel_url"):
            br = _run([PYTHON, str(bootstrap), "--scaffold-secrets"])
            report["steps"]["bootstrap_env"] = {"ok": br.returncode == 0}
            print(f"[{'OK' if br.returncode == 0 else 'WARN'}] bootstrap_env")
        if tunnel.get("tunnel_probe_ok"):
            print(f"[OK] Tunnel: {tunnel.get('tunnel_url')} (pid={tunnel.get('cloudflared_pid')})")
        else:
            print(
                f"[WARN] Tunnel URL saved but HTTPS probe failed locally — "
                f"paste into Android: {tunnel.get('tunnel_url')}"
            )
            if args.strict_tunnel:
                REPORT_FILE.write_text(json.dumps(report, indent=2), encoding="utf-8")
                return 1

    report["steps"]["smoke"] = _run_smoke()
    print(f"[{'OK' if report['steps']['smoke'].get('ok') else 'FAIL'}] smoke_tunnel")

    if args.verify:
        print("[INFO] Running full verify_launch (may take ~5 min) …")
        report["steps"]["verify_launch"] = _run_verify()
        print(f"[{'OK' if report['steps']['verify_launch'].get('ok') else 'FAIL'}] verify_launch")

    report["tunnel_url"] = (
        TUNNEL_FILE.read_text(encoding="utf-8").strip() if TUNNEL_FILE.is_file() else None
    )
    env_check = ROOT / "scripts" / "guardian" / "check_env.py"
    if env_check.is_file():
        er = _run([PYTHON, str(env_check)])
        report["env_check"] = {"ok": er.returncode == 0, "returncode": er.returncode}

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_FILE.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[OK] Report → {REPORT_FILE}")

    verify_step = report["steps"].get("verify_launch")
    if args.verify and verify_step is not None:
        failed = not verify_step.get("ok")
    else:
        failed = not report["steps"]["smoke"].get("ok")

    if failed:
        print("[FAIL] Auto-start completed with failures.")
        return 1

    print("[OK] Auto-start complete. Paste tunnel URL into Android App.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())