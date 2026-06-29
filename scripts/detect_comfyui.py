"""Detect local ComfyUI installation."""
from __future__ import annotations

from pathlib import Path


def _comfyui_disabled() -> bool:
    try:
        root = Path(__file__).resolve().parent.parent
        import sys

        if str(root) not in sys.path:
            sys.path.insert(0, str(root))
        from monster_ai.config import load_settings

        launcher = load_settings().launcher
        if not launcher.comfyui_enabled:
            return True
        path = (launcher.comfyui_path or "").strip().lower()
        return path in ("disabled", "off", "none")
    except Exception:
        return False


def find_comfyui() -> Path | None:
    if _comfyui_disabled():
        return None
    candidates = [
        Path(__file__).resolve().parent.parent.parent / "comfyui",
        Path("C:/MonsterAI/comfyui"),
        Path.home() / "ComfyUI",
    ]
    for base in candidates:
        portable = base / "ComfyUI_windows_portable_nvidia" / "ComfyUI_windows_portable"
        if (portable / "run_nvidia_gpu.bat").exists():
            return portable
        if (base / "main.py").exists() and (base / "models").exists():
            return base
    return None


if __name__ == "__main__":
    found = find_comfyui()
    print(found if found else "not found")