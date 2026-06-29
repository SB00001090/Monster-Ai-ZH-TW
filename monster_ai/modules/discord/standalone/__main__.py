"""Run MonsterGuard as standalone process (with optional Monster AI chat bridge)."""
from __future__ import annotations

import asyncio
import logging
import os
import sys

from monster_ai.config import load_settings
from monster_ai.core.self_repair import SelfRepairEngine
from monster_ai.modules.chat.service import ChatService
from monster_ai.modules.discord.guard.bot import MonsterGuardBot
from monster_ai.modules.roleplay.service import RoleplayService


async def main() -> None:
    logging.basicConfig(level=logging.INFO)
    settings = load_settings()
    settings.modules.discord.enabled = True
    settings.modules.discord.guard.mode = "standalone"

    token = os.getenv(settings.modules.discord.token_env, "")
    if not token:
        print(f"Set {settings.modules.discord.token_env}", file=sys.stderr)
        sys.exit(1)

    repair = SelfRepairEngine(settings)
    await repair.start()

    chat = ChatService(repair, settings)
    roleplay = None
    if settings.modules.roleplay.enabled:
        roleplay = RoleplayService(settings, repair)

    bot = MonsterGuardBot(settings, repair=repair, chat=chat, roleplay=roleplay)
    try:
        await bot.start(token)
    finally:
        await repair.stop()


if __name__ == "__main__":
    asyncio.run(main())