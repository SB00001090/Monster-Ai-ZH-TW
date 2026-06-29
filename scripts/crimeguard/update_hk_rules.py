"""Daily HK crime blocklist update for CrimeGuard."""
from __future__ import annotations

import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

import httpx
import yaml

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

from monster_ai.protection.crimeguard.rules import DEFAULT_HK_RULES

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("crimeguard-update")


def main() -> int:
    from monster_ai.config import load_settings

    settings = load_settings()
    cg = settings.protection.crimeguard
    out_dir = ROOT / "data" / "crimeguard"
    out_dir.mkdir(parents=True, exist_ok=True)
    rules_path = out_dir / "hk_rules.yaml"
    vpn_path = out_dir / "vpn_exit_nodes.yaml"

    rules = DEFAULT_HK_RULES.copy()
    rules["updated_at"] = datetime.now(timezone.utc).isoformat()

    if cg.rules_sync_url:
        try:
            r = httpx.get(cg.rules_sync_url, timeout=30, follow_redirects=True)
            r.raise_for_status()
            remote = yaml.safe_load(r.text) or {}
            if remote.get("categories"):
                rules.update(remote)
                logger.info("Merged remote rules from %s", cg.rules_sync_url)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Remote rules fetch failed: %s", exc)

    rules_path.write_text(yaml.dump(rules, allow_unicode=True), encoding="utf-8")

    vpn_defaults = {
        "version": datetime.now(timezone.utc).strftime("vpn-%Y.%m.%d"),
        "exit_nodes": [],
        "vpn_asns": ["AS9009", "AS60068", "AS212238"],
    }
    if not vpn_path.exists():
        vpn_path.write_text(yaml.dump(vpn_defaults, allow_unicode=True), encoding="utf-8")

    logger.info("HK rules written: %s (%s)", rules_path, rules.get("version"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())