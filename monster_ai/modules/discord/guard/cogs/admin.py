"""MonsterGuard admin commands."""
from __future__ import annotations

import asyncio

import discord

from monster_ai.modules.discord.guard.cogs.guard_group import guard_group


@guard_group.command(name="status", description="查看 MonsterGuard 保護狀態")
async def guard_status(interaction: discord.Interaction) -> None:
    await interaction.response.defer(ephemeral=True)
    bot = interaction.client
    status = bot.status_dict()  # type: ignore[attr-defined]
    store = bot.guild_store  # type: ignore[attr-defined]
    guild_id = interaction.guild_id or 0
    cfg = await store.get(guild_id)
    blocked_24h = await asyncio.to_thread(
        bot.privacy_log.count_recent, guild_id, 24  # type: ignore[attr-defined]
    )

    embed = discord.Embed(title="MonsterGuard 狀態", color=0x6EE7B7)
    embed.add_field(name="Bot 狀態", value="在線", inline=True)
    embed.add_field(name="規則版本", value=status["rules_version"], inline=True)
    embed.add_field(name="保護強度", value=cfg.protection_level, inline=True)
    embed.add_field(name="AI 後端", value=status["ai_backend"], inline=True)
    embed.add_field(name="24h 攔截", value=str(blocked_24h), inline=True)
    embed.add_field(name="本次掃描", value=str(status["scanned"]), inline=True)
    embed.add_field(name="Chat Bridge", value="啟用" if status["chat_bridge"] else "關閉", inline=True)
    embed.set_footer(text=f"模式: {status['mode']} | 設定完成: {cfg.setup_complete}")
    await interaction.followup.send(embed=embed, ephemeral=True)


@guard_group.command(name="config", description="查看目前伺服器設定（需管理伺服器）")
async def guard_config(interaction: discord.Interaction) -> None:
    if not interaction.user.guild_permissions.manage_guild:
        await interaction.response.send_message("需要「管理伺服器」權限。", ephemeral=True)
        return
    store = interaction.client.guild_store  # type: ignore[attr-defined]
    cfg = await store.get(interaction.guild_id or 0)
    lines = [
        f"保護強度: {cfg.protection_level}",
        f"動作模式: {cfg.action_mode}",
        f"攔截門檻: {cfg.block_threshold}",
        f"AI 增強: {'是' if cfg.ai_enabled else '否'}",
        f"Mod 頻道: <#{cfg.mod_channel_id}>" if cfg.mod_channel_id else "Mod 頻道: 未設定",
    ]
    await interaction.response.send_message("\n".join(lines), ephemeral=True)


async def setup(bot: discord.Client) -> None:
    pass