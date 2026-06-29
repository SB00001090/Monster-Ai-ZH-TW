"""Enable CrimeGuard in config.yaml."""
from __future__ import annotations

import argparse
from pathlib import Path

import yaml


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="config.yaml")
    args = parser.parse_args()
    p = Path(args.config)
    data = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
    cg = data.setdefault("protection", {}).setdefault("crimeguard", {})
    cg.update(
        {
            "enabled": True,
            "locale": "zh-HK",
            "llm_analysis_enabled": True,
            "vpn_detection_enabled": True,
            "vpn_scan_interval_seconds": 15,
            "device_contact_detection_enabled": True,
            "device_contact_scan_interval_seconds": 10,
            "device_contact_scan_on_prompt": True,
            "device_contact_lock_on_high_risk": True,
            "device_contact_lock_min_score": 70,
            "escalate_usb_bluetooth_lock": False,
            "escalate_self_repair_on_lock": True,
            "network_lock_enabled": True,
            "lock_mode": "localhost_only",
            "allow_local_services": True,
            "auto_lock_on_crime": True,
            "vpn_lock_on_high_risk": True,
            "vpn_lock_min_score": 60,
            "block_chat_when_locked": True,
            "block_generation_when_locked": True,
            "recovery_token": "MONSTER-RECOVER-2026",
            "data_dir": "./data/crimeguard",
        }
    )
    p.write_text(yaml.dump(data, allow_unicode=True, default_flow_style=False), encoding="utf-8")
    print("CrimeGuard enabled")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())