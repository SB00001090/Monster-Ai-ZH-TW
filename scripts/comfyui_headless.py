"""Start ComfyUI without CMD window or browser (headless API mode)."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

CREATE_NO_WINDOW = 0x08000000 if sys.platform == "win32" else 0


def comfyui_display_name(comfy_path: Path | None) -> str:
    """Short label for logs/UI — hide long portable paths."""
    if comfy_path is None:
        return "ComfyUI"
    return "ComfyUI (headless)"


def build_comfyui_command(comfy_path: Path) -> tuple[list[str], Path]:
    """Return (cmd, cwd) for headless ComfyUI."""
    py = comfy_path / "python_embeded" / "python.exe"
    main_py = comfy_path / "ComfyUI" / "main.py"
    if not main_py.exists():
        main_py = comfy_path / "main.py"
    cwd = main_py.parent

    if py.exists():
        cmd = [
            str(py),
            "-s",
            str(main_py),
            "--listen",
            "127.0.0.1",
            "--port",
            "8188",
            "--disable-auto-launch",
        ]
    else:
        cmd = [
            sys.executable,
            str(main_py),
            "--listen",
            "127.0.0.1",
            "--port",
            "8188",
            "--disable-auto-launch",
        ]
    return cmd, cwd


def start_comfyui_headless(comfy_path: Path, log_path: Path | None = None) -> subprocess.Popen:
    """Launch ComfyUI in background with no console window."""
    cmd, cwd = build_comfyui_command(comfy_path)
    if log_path is None:
        log_path = Path(__file__).resolve().parent.parent / "data" / "logs" / "comfyui.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_f = open(log_path, "a", encoding="utf-8")  # noqa: SIM115
    kwargs: dict = {
        "cwd": str(cwd),
        "stdout": log_f,
        "stderr": subprocess.STDOUT,
    }
    if sys.platform == "win32":
        kwargs["creationflags"] = CREATE_NO_WINDOW
    return subprocess.Popen(cmd, **kwargs)