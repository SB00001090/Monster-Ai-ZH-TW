#!/usr/bin/env python3
"""Sync Guardian tunnel URL + integration placeholders into .env."""
from __future__ import annotations

import argparse
import json
import secrets
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
TUNNEL_FILE = ROOT / "data" / "guardian-ai" / "tunnel_url.txt"
ENV_FILE = ROOT / ".env"
REPORT_FILE = ROOT / "data" / "guardian-ai" / "env_bootstrap.json"
HOOKS_FILE = ROOT / "data" / "guardian-ai" / "integration_hooks.json"

SYNC_KEYS = (
    ("GUARDIAN_TUNNEL_URL", "Tunnel HTTPS for Android"),
    ("MONSTER_TUNNEL_URL", "Dify workflow tunnel variable"),
    ("VITE_MONSTER_API_URL", "Cloudflare Pages API target"),
)

SCAFFOLD_SECRET_KEYS = (
    ("MAKE_WEBHOOK_SECRET", "Make deploy-hook"),
    ("SENTRY_WEBHOOK_SECRET", "Sentry issue hook"),
)


def _read_env(path: Path) -> list[str]:
    if not path.is_file():
        return []
    return path.read_text(encoding="utf-8").splitlines()


def _get_line(lines: list[str], key: str) -> str | None:
    prefix = f"{key}="
    for line in lines:
        if line.startswith(prefix) and not line.startswith(f"# {key}="):
            return line.split("=", 1)[1].strip()
    return None


def _set_or_append(lines: list[str], key: str, value: str, *, force: bool) -> bool:
    prefix = f"{key}="
    for i, line in enumerate(lines):
        if line.startswith(prefix):
            if force or not line.split("=", 1)[1].strip():
                lines[i] = f"{prefix}{value}"
                return True
            return False
        if line.startswith(f"# {prefix}"):
            if force:
                lines[i] = f"{prefix}{value}"
                return True
            return False
    lines.append(f"{prefix}{value}")
    return True


def _write_hooks(tunnel_url: str, make_secret: str, sentry_secret: str) -> dict[str, object]:
    base = tunnel_url.rstrip("/")
    hooks = {
        "tunnel_url": base,
        "make_deploy_hook": {
            "url": f"{base}/api/integrations/make/deploy-hook",
            "header": "X-Make-Secret",
            "secret_env": "MAKE_WEBHOOK_SECRET",
        },
        "sentry_issue_hook": {
            "url": f"{base}/api/integrations/sentry/hook",
            "header": "X-Sentry-Hook-Secret",
            "secret_env": "SENTRY_WEBHOOK_SECRET",
        },
        "status_url": f"{base}/api/integrations/status",
        "secrets_configured": {
            "make": bool(make_secret),
            "sentry": bool(sentry_secret),
        },
    }
    HOOKS_FILE.parent.mkdir(parents=True, exist_ok=True)
    HOOKS_FILE.write_text(json.dumps(hooks, ensure_ascii=False, indent=2), encoding="utf-8")
    return hooks


def main() -> int:
    parser = argparse.ArgumentParser(description="Bootstrap Guardian .env from tunnel_url.txt")
    parser.add_argument("--force", action="store_true", help="Overwrite existing tunnel URLs in .env")
    parser.add_argument(
        "--scaffold-secrets",
        action="store_true",
        help="Generate MAKE_WEBHOOK_SECRET / SENTRY_WEBHOOK_SECRET when unset",
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    print("Guardian Ai bootstrap env")
    print("Developed by Suckbob | Guardian Ai")
    print("=" * 60)

    tunnel_url = TUNNEL_FILE.read_text(encoding="utf-8").strip().rstrip("/") if TUNNEL_FILE.is_file() else ""
    if not tunnel_url:
        print("[WARN] No tunnel URL in data/guardian-ai/tunnel_url.txt — run auto_start first")
        return 0

    lines = _read_env(ENV_FILE)
    changed: dict[str, str] = {}
    for key, _desc in SYNC_KEYS:
        current = _get_line(lines, key)
        if current and not args.force:
            continue
        if _set_or_append(lines, key, tunnel_url, force=args.force):
            changed[key] = tunnel_url

    scaffolded: dict[str, str] = {}
    if args.scaffold_secrets:
        for key, _desc in SCAFFOLD_SECRET_KEYS:
            current = _get_line(lines, key)
            if current:
                continue
            token = secrets.token_urlsafe(32)
            if _set_or_append(lines, key, token, force=False):
                scaffolded[key] = token

    make_secret = _get_line(lines, "MAKE_WEBHOOK_SECRET") or scaffolded.get("MAKE_WEBHOOK_SECRET", "")
    sentry_secret = _get_line(lines, "SENTRY_WEBHOOK_SECRET") or scaffolded.get("SENTRY_WEBHOOK_SECRET", "")

    report: dict[str, object] = {
        "tunnel_url": tunnel_url,
        "changed": changed,
        "scaffolded": list(scaffolded.keys()),
        "env_file": str(ENV_FILE),
    }
    REPORT_FILE.parent.mkdir(parents=True, exist_ok=True)
    REPORT_FILE.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    dirty = bool(changed or scaffolded)
    if dirty and not args.dry_run:
        ENV_FILE.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")

    if tunnel_url and not args.dry_run:
        report["integration_hooks"] = _write_hooks(tunnel_url, make_secret or "", sentry_secret or "")

    print(json.dumps(report, ensure_ascii=False, indent=2))
    if changed:
        print(f"[OK] Updated {len(changed)} tunnel keys in .env")
    if scaffolded:
        print(f"[OK] Scaffolded {len(scaffolded)} webhook secrets in .env")
    if not changed and not scaffolded:
        print("[OK] .env already configured (use --force for tunnel URLs)")
    if report.get("integration_hooks"):
        print(f"[OK] Hook URLs → {HOOKS_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())