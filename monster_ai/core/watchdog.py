"""Process watchdog: Ollama, ComfyUI, log errors."""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import httpx

from monster_ai.config import Settings, WatchdogSettings
from monster_ai.core.code_repair_agent import CodeRepairAgent
from monster_ai.core.process_manager import ProcessManager
from monster_ai.protection.notifications.hub import NotificationHub, SecurityAlert

logger = logging.getLogger(__name__)


@dataclass
class WatchdogState:
    ollama_ok: bool = False
    comfyui_ok: bool = False
    last_error: str | None = None
    repair_attempts: int = 0
    checks: int = 0


class Watchdog:
    def __init__(
        self,
        settings: Settings,
        code_repair: CodeRepairAgent | None,
        notify: NotificationHub | None,
        root: Path,
    ) -> None:
        self.settings = settings
        self.wd: WatchdogSettings = settings.repair.watchdog
        self.code_repair = code_repair
        self.notify = notify
        self.processes = ProcessManager(root)
        self.state = WatchdogState()
        self._task: asyncio.Task | None = None
        self._log_offset = 0

    async def start(self) -> None:
        if not self.wd.enabled:
            return
        await self._check_once()
        self._task = asyncio.create_task(self._loop())

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _loop(self) -> None:
        while True:
            await asyncio.sleep(self.settings.repair.interval_seconds)
            await self._check_once()

    def _find_comfyui(self) -> Path | None:
        import sys

        scripts = self.processes.root / "scripts"
        sys.path.insert(0, str(scripts))
        from detect_comfyui import find_comfyui

        return find_comfyui()

    async def _ping(self, url: str) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                if "11434" in url:
                    r = await client.get(f"{url.rstrip('/')}/api/tags")
                else:
                    r = await client.get(f"{url.rstrip('/')}/system_stats")
                return r.status_code == 200
        except httpx.HTTPError:
            return False

    async def _check_once(self) -> None:
        self.state.checks += 1
        if self.wd.check_ollama:
            self.state.ollama_ok = await self._ping(self.settings.llm.ollama_url)
            if not self.state.ollama_ok:
                self.state.last_error = "Ollama offline"
                await self._notify_repair("Ollama offline — check ollama serve")

        if self.wd.check_comfyui and self.settings.launcher.comfyui_enabled:
            url = self.settings.modules.image.comfyui_url
            self.state.comfyui_ok = await self._ping(url)
            if not self.state.comfyui_ok and self.wd.restart_comfyui:
                path = self._find_comfyui()
                if path:
                    headless = self.settings.launcher.comfyui_headless
                    self.processes.restart_comfyui_windows(path, headless=headless)
                    await self._notify_repair(
                        "Restarted ComfyUI (headless)" if headless else "Restarted ComfyUI"
                    )

        await self._scan_logs_for_errors()

    async def _scan_logs_for_errors(self) -> None:
        log_path = Path("./data/logs/app.log")
        if not log_path.exists():
            return
        text = log_path.read_text(encoding="utf-8", errors="ignore")
        chunk = text[self._log_offset :]
        self._log_offset = len(text)
        if "Traceback" not in chunk or not self.code_repair:
            return
        if self.settings.repair.mode != "full_auto":
            return
        result = await self.code_repair.attempt_fix(chunk[-3000:])
        self.state.repair_attempts += 1
        await self._notify_repair(result.message)

    async def _notify_repair(self, message: str) -> None:
        if self.notify:
            await self.notify.notify(
                SecurityAlert(level="repair", message=message, action="watchdog")
            )

    def to_dict(self) -> dict[str, Any]:
        return {
            "enabled": self.wd.enabled,
            "ollama_ok": self.state.ollama_ok,
            "comfyui_ok": self.state.comfyui_ok,
            "last_error": self.state.last_error,
            "repair_attempts": self.state.repair_attempts,
            "checks": self.state.checks,
        }