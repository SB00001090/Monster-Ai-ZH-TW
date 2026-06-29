"""Restart local Monster AI / ComfyUI / Ollama processes."""
from __future__ import annotations

import logging
import subprocess
import sys
from pathlib import Path

logger = logging.getLogger(__name__)


class ProcessManager:
    def __init__(self, root: Path) -> None:
        self.root = root

    def restart_monster_ai(self) -> None:
        launcher = self.root / "scripts" / "launcher.py"
        if launcher.exists():
            subprocess.Popen([sys.executable, str(launcher)], cwd=str(self.root))
        else:
            subprocess.Popen([sys.executable, str(self.root / "main.py")], cwd=str(self.root))

    def restart_comfyui_windows(self, comfy_path: Path, *, headless: bool = True) -> None:
        if headless:
            scripts = self.root / "scripts"
            if str(scripts) not in sys.path:
                sys.path.insert(0, str(scripts))
            from comfyui_headless import start_comfyui_headless

            log = self.root / "data" / "logs" / "comfyui.log"
            start_comfyui_headless(comfy_path, log)
            logger.info("Restarted ComfyUI headless")
            return
        bat = comfy_path / "run_nvidia_gpu.bat"
        if bat.exists():
            subprocess.Popen(
                'start "ComfyUI" cmd /k run_nvidia_gpu.bat',
                cwd=str(comfy_path),
                shell=True,
            )

    def restart_ollama_hint(self) -> str:
        return "Run: ollama serve (if not already running)"