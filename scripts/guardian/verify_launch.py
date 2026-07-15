#!/usr/bin/env python3
"""Guardian Ai pre-launch verification — smoke_tunnel + checklist pytest suite.

Requires project deps (fastapi, pytest). On Windows use Python 3.11:
  py -3.11 scripts/guardian/verify_launch.py
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
REPORT_FILE = ROOT / "data" / "guardian-ai" / "verify_launch_report.json"
_SUBPROC_ENV = {**os.environ, "PYTHONWARNINGS": "ignore::DeprecationWarning"}

TESTS = [
    "tests/test_guardian_launch_checklist.py",
    "tests/test_guardian_platform.py",
    "tests/test_guardian_training_vault.py",
    "tests/test_guardian_network_learning.py",
    "tests/test_guardian_firewall.py",
    "tests/test_guardian_g3_autofix.py",
    "tests/test_guardian_curriculum.py",
    "tests/test_guardian_success_tracker.py",
    "tests/test_sentry_orchestrator.py",
    "tests/test_guardian_image_pipeline.py",
    "tests/test_guardian_backstory.py",
    "tests/test_integrations_api.py",
    "tests/test_likeness_scorer.py",
    "tests/test_generation_router.py",
    "tests/test_commercial.py",
]


def _backend_healthy() -> bool:
    try:
        import httpx

        r = httpx.get("http://127.0.0.1:7860/health", timeout=3.0)
        return r.status_code == 200
    except Exception:
        return False


def _ensure_backend() -> bool:
    if _backend_healthy():
        return True
    restart = ROOT / "scripts" / "guardian" / "restart_backend.py"
    if not restart.is_file():
        return False
    print("[WARN] Backend down — restarting main.py …")
    r = subprocess.run(
        [sys.executable, str(restart), "--no-pin"],
        cwd=str(ROOT),
        env=_SUBPROC_ENV,
    )
    return r.returncode == 0 and _backend_healthy()


def _write_report(*, ok: bool, detail: str) -> None:
    REPORT_FILE.parent.mkdir(parents=True, exist_ok=True)
    REPORT_FILE.write_text(
        json.dumps({"ok": ok, "detail": detail}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _require_deps() -> int | None:
    try:
        import fastapi  # noqa: F401
        import pytest  # noqa: F401
    except ImportError as exc:
        print(f"[FAIL] Missing dependency: {exc}")
        print("Install: pip install -r requirements.txt")
        print("Or run: py -3.11 scripts/guardian/verify_launch.py")
        return 1
    return None


def main() -> int:
    dep_err = _require_deps()
    if dep_err is not None:
        return dep_err

    print("Guardian Ai launch verification")
    print("Developed by Suckbob | Guardian Ai")
    print("=" * 60)

    if not _ensure_backend():
        print("\n[FAIL] Backend not reachable at :7860 — run auto-guardian.bat")
        _write_report(ok=False, detail="backend_unreachable")
        return 1

    smoke = subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts" / "guardian" / "smoke_tunnel.py"),
            "--spawn-dev",
            "--require-live",
        ],
        cwd=str(ROOT),
        env=_SUBPROC_ENV,
    )
    if smoke.returncode != 0:
        print("\n[FAIL] smoke_tunnel.py failed.")
        _write_report(ok=False, detail="smoke_tunnel_failed")
        return smoke.returncode

    cmd = [sys.executable, "-m", "pytest", *TESTS, "-q", "--tb=line"]
    result = subprocess.run(cmd, cwd=str(ROOT), env=_SUBPROC_ENV)
    if result.returncode != 0:
        print(f"\n[FAIL] pytest exit code {result.returncode}")
        _write_report(ok=False, detail=f"pytest_exit_{result.returncode}")
        return result.returncode

    if not _ensure_backend():
        print("\n[FAIL] Backend lost during pytest — run auto-guardian.bat")
        _write_report(ok=False, detail="backend_lost_after_pytest")
        return 1

    integrations = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "guardian" / "smoke_integrations.py")],
        cwd=str(ROOT),
        env=_SUBPROC_ENV,
    )
    if integrations.returncode != 0:
        print("\n[FAIL] smoke_integrations.py failed.")
        _write_report(ok=False, detail="smoke_integrations_failed")
        return integrations.returncode

    print("\n[OK] All launch checks passed.")
    _write_report(ok=True, detail="all_passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())