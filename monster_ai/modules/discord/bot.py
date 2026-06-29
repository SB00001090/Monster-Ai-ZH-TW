"""Discord service — MonsterGuard bot + Monster AI chat bridge."""
from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any

from monster_ai.config import Settings

if TYPE_CHECKING:
    from monster_ai.core.self_repair import SelfRepairEngine
    from monster_ai.modules.chat.service import ChatService
    from monster_ai.modules.roleplay.service import RoleplayService

logger = logging.getLogger(__name__)

_PROJECT_ROOT = Path(__file__).resolve().parents[3]


@dataclass
class GuardHealStats:
    restarts: int = 0
    last_heal_at: float | None = None
    last_error: str | None = None
    token_fingerprint: str = ""


class DiscordService:
    name = "discord"

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._bot = None
        self._task: asyncio.Task | None = None
        self._heal_task: asyncio.Task | None = None
        self._running = False
        self._stop = False
        self._fatal_auth_error = False
        self._offline_streak = 0
        self._heal_stats = GuardHealStats()
        self._repair: SelfRepairEngine | None = None
        self._chat: ChatService | None = None
        self._roleplay: RoleplayService | None = None
        self._token: str = ""

    def _token_file_path(self) -> Path | None:
        primary = _PROJECT_ROOT / "discord.token.local"
        if primary.is_file():
            return primary
        legacy = Path("discord.token.local")
        return legacy if legacy.is_file() else None

    def _read_token_file(self) -> str:
        token_file = self._token_file_path()
        if not token_file:
            return ""
        lines = [
            ln.strip()
            for ln in token_file.read_text(encoding="utf-8-sig").splitlines()
            if ln.strip() and not ln.strip().startswith("#")
        ]
        return lines[0] if lines else ""

    def _token_fingerprint(self, token: str) -> str:
        if not token:
            return ""
        return hashlib.sha256(token.encode("utf-8")).hexdigest()[:16]

    def _sync_token(self) -> str:
        env_name = self.settings.modules.discord.token_env
        file_token = self._read_token_file()
        if file_token:
            fingerprint = self._token_fingerprint(file_token)
            if fingerprint != self._heal_stats.token_fingerprint:
                self._heal_stats.token_fingerprint = fingerprint
                os.environ[env_name] = file_token
                if self._fatal_auth_error:
                    logger.info("MonsterGuard token file updated; clearing auth fatal state")
                self._fatal_auth_error = False
            self._token = file_token
            return file_token

        env_token = os.getenv(env_name, "").strip()
        if env_token:
            self._token = env_token
            self._heal_stats.token_fingerprint = self._token_fingerprint(env_token)
            return env_token
        return ""

    def _resolve_token(self) -> str:
        if self._token:
            return self._token
        return self._sync_token()

    def heal_status_dict(self) -> dict[str, Any]:
        guard = self.settings.modules.discord.guard
        return {
            "enabled": guard.self_heal_enabled,
            "restarts": self._heal_stats.restarts,
            "last_error": self._heal_stats.last_error,
            "last_heal_at": self._heal_stats.last_heal_at,
            "fatal_auth": self._fatal_auth_error,
            "offline_streak": self._offline_streak,
        }

    async def health(self) -> dict[str, Any]:
        if not self.settings.modules.discord.enabled:
            return {"enabled": False, "healthy": False, "message": "Module disabled"}

        token = self._sync_token()
        if not token:
            return {
                "enabled": True,
                "healthy": False,
                "message": f"Set {self.settings.modules.discord.token_env} to enable",
            }

        if self._running and self._bot:
            status = self._bot.status_dict()
            return {
                "enabled": True,
                "healthy": True,
                "message": "MonsterGuard running",
                **status,
            }
        return {
            "enabled": True,
            "healthy": True,
            "message": "Token configured; bot not started",
        }

    def guard_status(self) -> dict[str, Any]:
        if self._bot and self._running:
            base = {"running": True, **self._bot.status_dict()}
        else:
            base = {"running": False}
        base["self_heal"] = self.heal_status_dict()
        return base

    async def start_guard(
        self,
        repair: SelfRepairEngine,
        chat: ChatService,
        roleplay: RoleplayService | None = None,
    ) -> None:
        if not self.settings.modules.discord.enabled:
            return
        if not self.settings.modules.discord.guard.enabled:
            logger.info("MonsterGuard disabled in config")
            return

        self._repair = repair
        self._chat = chat
        self._roleplay = roleplay
        self._stop = False

        token = self._sync_token()
        if not token:
            logger.warning(
                "MonsterGuard: no Discord token. Set %s or create discord.token.local",
                self.settings.modules.discord.token_env,
            )
            return

        await self._start_bot_task(token)
        self._start_heal_loop()

    def _start_heal_loop(self) -> None:
        guard = self.settings.modules.discord.guard
        if not guard.self_heal_enabled:
            return
        if self._heal_task and not self._heal_task.done():
            return
        self._heal_task = asyncio.create_task(self._heal_loop())

    async def _heal_loop(self) -> None:
        guard = self.settings.modules.discord.guard
        try:
            while not self._stop:
                await asyncio.sleep(guard.self_heal_interval_seconds)
                await self.ensure_guard_running()
        except asyncio.CancelledError:
            pass

    async def ensure_guard_running(self) -> None:
        guard = self.settings.modules.discord.guard
        if self._stop or not guard.self_heal_enabled:
            return
        if not self.settings.modules.discord.enabled or not guard.enabled:
            return

        self._heal_stats.last_heal_at = time.time()
        token = self._sync_token()
        if not token:
            self._heal_stats.last_error = "missing_token"
            return
        if self._fatal_auth_error:
            self._heal_stats.last_error = "fatal_auth"
            return

        task_alive = self._task is not None and not self._task.done()
        if task_alive and self._running:
            self._offline_streak = 0
            self._heal_stats.last_error = None
            return

        self._offline_streak += 1
        if self._offline_streak < 2:
            return

        logger.warning("MonsterGuard self-heal: restarting bot (streak=%s)", self._offline_streak)
        await self._restart_guard(token)

    async def _restart_guard(self, token: str) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        await self._close_bot()
        self._offline_streak = 0
        await self._start_bot_task(token)
        self._heal_stats.restarts += 1
        self._heal_stats.last_error = None

    async def _start_bot_task(self, token: str) -> None:
        if self._task and not self._task.done():
            return
        self._token = token
        self._task = asyncio.create_task(self._run_bot(token))

    def _create_bot(self) -> None:
        from monster_ai.modules.discord.guard.bot import MonsterGuardBot

        self._bot = MonsterGuardBot(
            self.settings,
            repair=self._repair,
            chat=self._chat,
            roleplay=self._roleplay,
        )

    async def _close_bot(self) -> None:
        if not self._bot:
            return
        try:
            if not self._bot.is_closed():
                await self._bot.close()
        except Exception as exc:  # noqa: BLE001
            logger.debug("MonsterGuard close: %s", exc)
        self._bot = None

    async def _run_bot(self, token: str) -> None:
        guard = self.settings.modules.discord.guard
        delay = 5.0
        max_delay = float(guard.self_heal_max_backoff_seconds)
        while not self._stop:
            self._create_bot()
            assert self._bot is not None
            self._running = True
            try:
                await self._bot.start(token)
                if self._stop:
                    break
                logger.warning("MonsterGuard disconnected; reconnecting in %.0fs", delay)
            except asyncio.CancelledError:
                break
            except Exception as exc:  # noqa: BLE001
                fatal = exc.__class__.__name__
                self._heal_stats.last_error = fatal
                if fatal == "LoginFailure":
                    self._fatal_auth_error = True
                    logger.error(
                        "MonsterGuard Discord token invalid. Update discord.token.local to retry."
                    )
                    break
                if fatal == "PrivilegedIntentsRequired":
                    logger.error(
                        "MonsterGuard needs Discord Intents: MESSAGE CONTENT INTENT enabled"
                    )
                    break
                logger.exception("MonsterGuard bot crashed: %s", exc)
            finally:
                self._running = False
                await self._close_bot()

            if self._stop or self._fatal_auth_error:
                break
            await asyncio.sleep(delay)
            delay = min(delay * 2, max_delay)
        self._running = False

    async def stop_guard(self) -> None:
        self._stop = True
        if self._heal_task:
            self._heal_task.cancel()
            try:
                await self._heal_task
            except asyncio.CancelledError:
                pass
            self._heal_task = None
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        await self._close_bot()
        self._running = False