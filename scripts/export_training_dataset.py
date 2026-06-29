#!/usr/bin/env python3
"""Export unified training manifest from quality store and generation history."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main() -> int:
    out_dir = ROOT / "data" / "training" / "manifests"
    out_dir.mkdir(parents=True, exist_ok=True)
    samples: list[dict] = []

    quality_log = ROOT / "data" / "quality" / "quality_log.jsonl"
    if quality_log.exists():
        for line in quality_log.read_text(encoding="utf-8").splitlines():
            if line.strip():
                samples.append({"source": "quality", **json.loads(line)})

    history_index = ROOT / "data" / "logs" / "generation_history" / "index.jsonl"
    if history_index.exists():
        for line in history_index.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            row = json.loads(line)
            if row.get("type") in ("image", "portrait") and row.get("quality_passed"):
                samples.append({"source": "history", **row})

    out_path = out_dir / "training_manifest.json"
    out_path.write_text(json.dumps({"samples": samples, "count": len(samples)}, indent=2), encoding="utf-8")
    print(f"Exported {len(samples)} samples to {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())