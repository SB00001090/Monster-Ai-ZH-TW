#!/usr/bin/env python3
"""Report Guardian Ai integration env vars (set / missing)."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

from scripts.guardian.env_loader import load_env, tunnel_fallback

CHECKS = [
    ("GUARDIAN_TUNNEL_URL", "Tunnel HTTPS for Android / Pages"),
    ("MONSTER_TUNNEL_URL", "Dify workflow tunnel variable"),
    ("DIFY_API_KEY", "Dify orchestration"),
    ("SENTRY_DSN", "Backend Sentry"),
    ("VITE_SENTRY_DSN", "Frontend Sentry"),
    ("SENTRY_WEBHOOK_SECRET", "Sentry → /api/integrations/sentry/hook"),
    ("MAKE_WEBHOOK_SECRET", "Make deploy-hook"),
    ("GOOGLE_CLIENT_ID", "Guardian Google OAuth + Drive"),
    ("VITE_GOOGLE_CLIENT_ID", "Web Google OAuth"),
]


def main() -> int:
    print("Guardian Ai env check")
    print("Developed by Suckbob | Guardian Ai")
    print("=" * 60)

    load_env()
    url = tunnel_fallback()
    if url:
        for key in ("GUARDIAN_TUNNEL_URL", "MONSTER_TUNNEL_URL", "VITE_MONSTER_API_URL"):
            if not os.environ.get(key):
                os.environ[key] = url

    report: dict[str, object] = {"vars": {}, "missing": [], "set_count": 0}
    for key, desc in CHECKS:
        val = (os.environ.get(key) or "").strip()
        ok = bool(val)
        if ok:
            report["set_count"] = int(report["set_count"]) + 1
        report["vars"][key] = {"ok": ok, "description": desc}
        if not ok:
            report["missing"].append(key)

    report["total"] = len(CHECKS)
    report["release_keystore"] = (ROOT / "apps" / "guardian-ai-android" / "keystore" / "guardian-ai.jks").is_file()
    report["release_aab"] = (ROOT / "dist" / "guardian-ai-android-release.aab").is_file()

    print(json.dumps(report, ensure_ascii=False, indent=2))
    if report["missing"]:
        print(f"\n[WARN] Missing {len(report['missing'])} optional vars (see .env.example)")
        return 0
    print("\n[OK] All integration env vars present.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())