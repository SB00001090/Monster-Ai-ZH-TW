#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d .venv ]; then
  echo "Creating virtual environment..."
  python3 -m venv .venv
fi

source .venv/bin/activate
pip install -r requirements.txt -q

echo ""
echo "Monster AI launcher (Monster AI + optional ComfyUI)"
echo ""

python scripts/launcher.py