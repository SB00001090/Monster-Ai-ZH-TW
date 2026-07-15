#!/usr/bin/env python3
"""Smoke-test Guardian integration endpoints against a live backend."""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

from scripts.guardian.env_loader import load_env, tunnel_fallback

LOCAL = "http://127.0.0.1:7860"


def _get(url: str) -> tuple[int, dict]:
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))


def _post(url: str, body: dict, headers: dict[str, str] | None = None) -> tuple[int, dict]:
    data = json.dumps(body).encode("utf-8")
    hdrs = {"Content-Type": "application/json", **(headers or {})}
    req = urllib.request.Request(url, data=data, method="POST", headers=hdrs)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))


def _wait_backend(base: str, *, retries: int, delay_s: float) -> bool:
    health = f"{base.rstrip('/')}/health"
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(health, method="GET")
            with urllib.request.urlopen(req, timeout=5) as resp:
                if resp.status == 200:
                    return True
        except (urllib.error.URLError, TimeoutError):
            pass
        if attempt < retries:
            time.sleep(delay_s)
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Smoke Guardian integrations API")
    parser.add_argument("--base", default=LOCAL, help="Backend base URL")
    parser.add_argument("--retries", type=int, default=12, help="Backend health retries")
    parser.add_argument("--retry-delay", type=float, default=5.0, help="Seconds between retries")
    args = parser.parse_args()

    print("Guardian Ai integrations smoke")
    print("Developed by Suckbob | Guardian Ai")
    print("=" * 60)

    load_env()
    url = tunnel_fallback()
    if url:
        for key in ("GUARDIAN_TUNNEL_URL", "MONSTER_TUNNEL_URL"):
            if not os.environ.get(key):
                os.environ[key] = url

    base = args.base.rstrip("/")
    report: dict[str, object] = {"base": base, "steps": {}}

    if not _wait_backend(base, retries=args.retries, delay_s=args.retry_delay):
        report["steps"]["backend_wait"] = {"ok": False, "retries": args.retries}
        print(json.dumps(report, ensure_ascii=False, indent=2))
        print("\n[FAIL] Backend unreachable — run auto-guardian.bat")
        return 1
    report["steps"]["backend_wait"] = {"ok": True, "retries": args.retries}

    try:
        code, status = _get(f"{base}/api/integrations/status")
        report["steps"]["status"] = {"ok": code == 200, "code": code}
        if code == 200:
            report["integrations"] = {
                "sentry_configured": status.get("sentry_configured"),
                "sentry_webhook_configured": status.get("sentry_webhook_configured"),
                "make_secret_configured": status.get("make_secret_configured"),
                "workflow_error_configured": status.get("workflow_error_configured"),
                "google_drive_configured": status.get("google_drive_configured"),
                "supabase_configured": status.get("supabase_configured"),
            }
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        report["steps"]["status"] = {"ok": False, "error": str(exc)}
        print(json.dumps(report, ensure_ascii=False, indent=2))
        print("\n[FAIL] Backend unreachable — run auto-guardian.bat")
        return 1

    make_secret = (os.environ.get("MAKE_WEBHOOK_SECRET") or "").strip()
    make_headers = {"X-Make-Secret": make_secret} if make_secret else {}
    try:
        code, body = _post(
            f"{base}/api/integrations/make/deploy-hook",
            {"event": "integrations_snapshot", "detail": "smoke"},
            headers=make_headers,
        )
        report["steps"]["make_hook"] = {
            "ok": code == 200 and body.get("ok"),
            "code": code,
            "has_snapshot": "snapshot" in body,
        }
    except urllib.error.HTTPError as exc:
        report["steps"]["make_hook"] = {"ok": False, "code": exc.code, "error": exc.reason}
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        report["steps"]["make_hook"] = {"ok": False, "error": str(exc)}

    sentry_secret = (os.environ.get("SENTRY_WEBHOOK_SECRET") or "").strip()
    if sentry_secret:
        payload = {
            "action": "created",
            "data": {
                "issue": {
                    "id": "smoke-1",
                    "title": "smoke test",
                    "culprit": "smoke_integrations.py",
                    "permalink": "https://sentry.io/issues/smoke",
                }
            },
        }
        try:
            code, body = _post(
                f"{base}/api/integrations/sentry/hook",
                payload,
                headers={"X-Sentry-Hook-Secret": sentry_secret},
            )
            report["steps"]["sentry_hook"] = {
                "ok": code == 200,
                "code": code,
                "skipped": False,
            }
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:200]
            report["steps"]["sentry_hook"] = {
                "ok": False,
                "code": exc.code,
                "detail": detail,
            }
    else:
        report["steps"]["sentry_hook"] = {"ok": True, "skipped": True, "reason": "no SENTRY_WEBHOOK_SECRET"}

    out_path = ROOT / "data" / "guardian-ai" / "integrations_smoke.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(report, ensure_ascii=False, indent=2))
    failed = any(
        not step.get("ok")
        for step in report["steps"].values()
        if isinstance(step, dict) and not step.get("skipped")
    )
    if failed:
        print("\n[FAIL] Integration smoke failed.")
        return 1
    print(f"\n[OK] Integration smoke passed → {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())