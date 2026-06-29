#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."
python3 -m venv .venv 2>/dev/null || true
source .venv/bin/activate
python scripts/install_modules.py "$@"