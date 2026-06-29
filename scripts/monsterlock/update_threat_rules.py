"""Daily threat rule sync for MonsterLock + MonsterGuard."""
from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

import httpx
import yaml

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

from monster_ai.config import load_settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("monsterlock-update")


def _default_rules() -> dict:
    return {
        "version": datetime.now(timezone.utc).strftime("v%Y.%m.%d"),
        "anti_debug": {
            "block_processes": ["x64dbg", "ida64", "cheatengine", "ghidra"],
            "vm_indicators": ["virtualbox", "vmware", "qemu"],
        },
        "integrity": {
            "force_recheck": True,
            "min_check_interval_seconds": 30,
        },
        "signatures": [],
    }


def fetch_remote(url: str) -> dict | None:
    try:
        r = httpx.get(url, timeout=30, follow_redirects=True)
        r.raise_for_status()
        if "yaml" in url or r.headers.get("content-type", "").startswith("text/yaml"):
            return yaml.safe_load(r.text) or {}
        return r.json()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Remote fetch failed: %s", exc)
        return None


def main() -> int:
    settings = load_settings()
    ml = settings.protection.monsterlock
    guard = settings.modules.discord.guard
    out_dir = ROOT / "data" / "monsterlock"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "protection_rules.json"

    rules = _default_rules()
    urls = [u for u in (ml.rule_sync_url, guard.rule_sync_url) if u]
    for url in urls:
        remote = fetch_remote(url)
        if remote:
            rules.update(remote)
            logger.info("Merged rules from %s", url)

    rules["updated_at"] = datetime.now(timezone.utc).isoformat()
    out_path.write_text(json.dumps(rules, indent=2), encoding="utf-8")
    logger.info("Protection rules written: %s (version %s)", out_path, rules["version"])

    # Sync guard rules if packaged path exists
    guard_rules_dst = ROOT / "data" / "guard" / "rules"
    guard_rules_dst.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y.%m")
    guard_file = guard_rules_dst / f"v{stamp}.yaml"
    if not guard_file.exists():
        guard_file.write_text(
            yaml.dump(
                {
                    "version": f"v{stamp}",
                    "keywords": ["nitro", "free discord", "verify account"],
                },
                allow_unicode=True,
            ),
            encoding="utf-8",
        )
        logger.info("Guard rules stub: %s", guard_file)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())