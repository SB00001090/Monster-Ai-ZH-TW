"""Auto-generate firewall rules from quarantine + learning events."""
from __future__ import annotations

import json
import re
import time
from pathlib import Path
from typing import Any

import yaml

from monster_ai.protection.quarantine import QuarantineZone
from monster_ai.protection.rules import reload_dynamic_rules

AUTO_RULE_MIN_HITS = 3


class RuleGenerator:
    def __init__(self, data_dir: Path, quarantine: QuarantineZone) -> None:
        self.rules_path = data_dir / "dynamic_rules.yaml"
        self.snapshot_path = data_dir / "dynamic_rules.snapshot.json"
        self.quarantine = quarantine
        self.rules_path.parent.mkdir(parents=True, exist_ok=True)

    def _load_rules(self) -> list[dict[str, Any]]:
        if not self.rules_path.is_file():
            return []
        try:
            data = yaml.safe_load(self.rules_path.read_text(encoding="utf-8"))
            rules = data.get("rules") if isinstance(data, dict) else None
            return rules if isinstance(rules, list) else []
        except (yaml.YAMLError, OSError):
            return []

    def _save_rules(self, rules: list[dict[str, Any]]) -> None:
        payload = {"rules": rules, "updated_at": time.time()}
        self.rules_path.write_text(
            yaml.safe_dump(payload, allow_unicode=True, sort_keys=False),
            encoding="utf-8",
        )
        self.snapshot_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    def _reason_pattern(self, reason: str, path: str) -> tuple[str, int]:
        patterns = {
            "path_traversal": (r"\.\.[\\/]|%2e%2e", 85),
            "injection_pattern": (r"<script|javascript:|DROP\s+TABLE", 75),
            "api_scan": (r"/wp-admin|/\.env|/phpmyadmin", 70),
            "burst_traffic": (r".{0}", 0),
        }
        if reason in patterns:
            return patterns[reason]
        safe_path = re.escape(path[:80]) if path else ""
        if safe_path:
            return (safe_path, 65)
        return (reason[:40], 60)

    def maybe_generate_from_quarantine(self) -> dict[str, Any]:
        status = self.quarantine.status()
        reason_counts = status.get("reason_counts") or {}
        rules = self._load_rules()
        existing_ids = {r.get("id") for r in rules}
        added: list[str] = []

        for reason, count in reason_counts.items():
            if count < AUTO_RULE_MIN_HITS:
                continue
            rule_id = f"auto_{reason}"
            if rule_id in existing_ids:
                continue
            sample = next(
                (e for e in self.quarantine.list_active() if reason in (e.get("reasons") or [])),
                None,
            )
            path = sample.get("path", "") if sample else ""
            pattern, score = self._reason_pattern(reason, path)
            if score <= 0:
                continue
            rules.append(
                {
                    "id": rule_id,
                    "pattern": pattern,
                    "score": score,
                    "reason": reason,
                    "source": "quarantine_auto",
                    "created_at": time.time(),
                }
            )
            added.append(rule_id)

        if added:
            self._save_rules(rules)
            reload_dynamic_rules(self.rules_path)

        return {
            "ok": True,
            "added": added,
            "total_rules": len(rules),
            "reloaded": bool(added),
        }

    def restore_from_snapshot(self) -> dict[str, Any]:
        if not self.snapshot_path.is_file():
            return {"ok": False, "reason": "no_snapshot"}
        try:
            data = json.loads(self.snapshot_path.read_text(encoding="utf-8"))
            rules = data.get("rules") if isinstance(data, dict) else None
            if not isinstance(rules, list):
                return {"ok": False, "reason": "invalid_snapshot"}
            self._save_rules(rules)
            reload_dynamic_rules(self.rules_path)
            return {"ok": True, "total_rules": len(rules)}
        except (json.JSONDecodeError, OSError):
            return {"ok": False, "reason": "read_failed"}

    def status(self) -> dict[str, Any]:
        rules = self._load_rules()
        return {
            "rules_path": str(self.rules_path),
            "rule_count": len(rules),
            "auto_rules": [r.get("id") for r in rules if r.get("source") == "quarantine_auto"],
            "snapshot_exists": self.snapshot_path.is_file(),
        }