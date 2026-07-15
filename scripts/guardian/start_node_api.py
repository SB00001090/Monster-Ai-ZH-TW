#!/usr/bin/env python3
"""Start Node tRPC API on :3000 (API_ONLY) for Python :7860 web UI."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

from launcher import _probe_node_api, _start_node_api  # noqa: E402


def main() -> int:
    print("Guardian Ai — Node API starter")
    print("Developed by Suckbob | Guardian Ai")
    print("=" * 60)
    port = 3000
    if _probe_node_api(port):
        print(f"[OK] Node API already running on :{port}")
        return 0
    active = _start_node_api(port)
    if not active:
        print("[FAIL] Node API did not start. See data/logs/node-api.log")
        return 1
    print(f"[OK] Node API ready at http://127.0.0.1:{active}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())