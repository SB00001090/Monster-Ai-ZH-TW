#!/usr/bin/env python3
"""CLI for generation history."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from monster_ai.config import load_settings
from monster_ai.core.generation_history import GenerationHistory


def main() -> int:
    parser = argparse.ArgumentParser(description="Monster AI generation history")
    sub = parser.add_subparsers(dest="cmd", required=True)

    list_p = sub.add_parser("list")
    list_p.add_argument("--date")
    list_p.add_argument("--type")
    list_p.add_argument("--limit", type=int, default=20)

    search_p = sub.add_parser("search")
    search_p.add_argument("query")
    search_p.add_argument("--limit", type=int, default=20)

    purge_p = sub.add_parser("purge")
    purge_p.add_argument("--older-than", type=int, default=30)

    get_p = sub.add_parser("get")
    get_p.add_argument("job_id")

    args = parser.parse_args()
    settings = load_settings()
    history = GenerationHistory(settings.history)

    if args.cmd == "list":
        rows = history.list_entries(date=args.date, job_type=args.type, limit=args.limit)
    elif args.cmd == "search":
        rows = history.list_entries(query=args.query, limit=args.limit)
    elif args.cmd == "purge":
        n = history.purge_older_than(args.older_than)
        print(f"Removed {n} entries older than {args.older_than} days")
        return 0
    elif args.cmd == "get":
        row = history.get_entry(args.job_id)
        if not row:
            print("Not found", file=sys.stderr)
            return 1
        print(json.dumps(row, indent=2, ensure_ascii=False))
        return 0
    else:
        return 1

    for row in rows:
        print(
            f"{row.get('timestamp', '')[:19]}  [{row.get('type')}]  "
            f"score={row.get('quality_score')}  {row.get('prompt', '')[:60]}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())