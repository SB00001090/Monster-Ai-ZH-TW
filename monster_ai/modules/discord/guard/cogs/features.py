"""MonsterGuard capabilities — /guard features."""
from __future__ import annotations

import discord

from monster_ai.modules.discord.guard.capabilities import features_embed_description
from monster_ai.modules.discord.guard.cogs.guard_group import guard_group


@guard_group.command(name="features", description="查看 MonsterGuard 可攔截的詐騙類型與保護範圍")
async def guard_features(interaction: discord.Interaction) -> None:
    embed = discord.Embed(
        title="MonsterGuard 攔截能力",
        description=features_embed_description(),
        color=0x5865F2,
    )
    embed.set_footer(text="MonsterGuard · Monster AI | 使用 /guard setup 啟用保護")
    await interaction.response.send_message(embed=embed, ephemeral=True)


async def setup(bot: discord.Client) -> None:
    pass