#!/bin/sh
set -e
mkdir -p /app/data/logs/generation_history/records \
  /app/data/quality/bad /app/data/quality/good \
  /app/data/training/manifests /app/data/tmp \
  /app/data/characters/avatars

echo "Waiting for Ollama..."
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  if python -c "import httpx; httpx.get('${MONSTER_OLLAMA_URL:-http://ollama:11434}', timeout=2)" 2>/dev/null; then
    break
  fi
  sleep 2
done

echo "Waiting for ComfyUI..."
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30; do
  if python -c "import httpx; r=httpx.get('http://comfyui:8188/system_stats', timeout=2); exit(0 if r.status_code==200 else 1)" 2>/dev/null; then
    break
  fi
  sleep 2
done

exec "$@"