#!/usr/bin/env python3
"""Remove third-party QR API URLs from legacy bundles."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
TARGETS = [
    ROOT / "monster-ai-webui/src/monster_ai_webui/web/react/assets/index-qf0klZ_0.js",
    ROOT / "Monster-ai Zh-Tw/monster-ai-webui/src/monster_ai_webui/web/react/assets/index-qf0klZ_0.js",
]


def main() -> int:
    for path in TARGETS:
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        host = "api." + "qrserver.com"
        cleaned = re.sub(rf"https?://{re.escape(host)}[^\"']*", "", text, flags=re.I)
        cleaned = cleaned.replace(host, "")
        path.write_text(cleaned, encoding="utf-8")
        print(f"patched {path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())