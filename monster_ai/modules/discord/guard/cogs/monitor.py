"""Top-level /status and /about commands."""
from __future__ import annotations

import discord
from discord import app_commands

from monster_ai.modules.discord.guard.interaction_utils import safe_defer, safe_followup
from monster_ai.modules.discord.guard.ui.embeds import about_embed, status_embed


@app_commands.command(name="status", description="MonsterGuard v2.0 健康儀表板")
async def global_status(interaction: discord.Interaction) -> None:
    if not await safe_defer(interaction):
        return
    bot = interaction.client
    svc = getattr(bot, "discord_service", None)
    connected = bot.is_ready() and not bot.is_closed()

    resilience: dict = {}
    monster_ai: dict = {}
    guardian: dict = {}
    if svc:
        gs = svc.guard_status()
        resilience = gs.get("resilience", {})
        monster_ai = gs.get("monster_ai", {})
        connected = gs.get("connected", connected)
        client = getattr(svc, "_monster_client", None)
        if client is not None:
            try:
                guardian = await client.guardian_status()
            except Exception:  # noqa: BLE001
                guardian = {}

    guard_stats = bot.status_dict() if hasattr(bot, "status_dict") else {}
    embed = status_embed(
        connected=connected,
        resilience=resilience,
        monster_ai=monster_ai,
        guardian=guardian,
        guard_stats=guard_stats,
    )
    await safe_followup(interaction, embed=embed)


@app_commands.command(name="about", description="MonsterGuard 版本與開發者資訊")
async def about_cmd(interaction: discord.Interaction) -> None:
    if not await safe_defer(interaction):
        return
    await safe_followup(interaction, embed=about_embed())


async def setup(bot: discord.Client) -> None:
    for cmd in (global_status, about_cmd):
        try:
            bot.tree.add_command(cmd, override=True)
        except Exception:  # noqa: BLE001
            pass
