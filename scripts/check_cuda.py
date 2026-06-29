"""Check GPU and Ollama availability."""
from __future__ import annotations

import subprocess
import sys

import httpx


def check_nvidia() -> bool:
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader"],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
        if result.returncode == 0 and result.stdout.strip():
            print("GPU:", result.stdout.strip())
            return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
    print("GPU: nvidia-smi not found (CPU-only mode possible)")
    return False


def check_ollama(url: str = "http://127.0.0.1:11434") -> bool:
    try:
        response = httpx.get(f"{url}/api/tags", timeout=5)
        if response.status_code == 200:
            models = [m.get("name", "") for m in response.json().get("models", [])]
            print("Ollama: OK")
            if models:
                print("Models:", ", ".join(models))
            else:
                print("Models: none — run `ollama pull llama3.2:3b`")
            return True
    except httpx.HTTPError as exc:
        print(f"Ollama: not reachable ({exc})")
    return False


def main() -> int:
    print("Monster AI — environment check\n")
    check_nvidia()
    ok = check_ollama()
    print()
    if ok:
        print("Ready to run: python main.py")
        return 0
    print("Start Ollama first: https://ollama.com")
    return 1


if __name__ == "__main__":
    sys.exit(main())