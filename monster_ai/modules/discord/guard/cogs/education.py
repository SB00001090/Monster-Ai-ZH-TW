"""DM scam education commands."""
from __future__ import annotations

import discord
from discord import app_commands

from monster_ai.modules.discord.guard.cogs.guard_group import guard_group


@guard_group.command(name="education", description="發送 DM 防詐騙教育指南到此頻道")
async def guard_education(interaction: discord.Interaction) -> None:
    if not interaction.user.guild_permissions.manage_messages:
        await interaction.response.send_message("需要「管理訊息」權限。", ephemeral=True)
        return
    from monster_ai.modules.discord.guard.capabilities import INTERCEPT_CATEGORIES

    scam_lines = "\n".join(
        f"{i + 1}. **{c.title}** — {c.examples.split('、')[0]}"
        for i, c in enumerate(INTERCEPT_CATEGORIES)
    )
    embed = discord.Embed(
        title="Discord 防詐騙指南",
        description=(
            "**MonsterGuard 可攔截的詐騙類型：**\n"
            f"{scam_lines}\n\n"
            "**如何自保：**\n"
            "• 永不點擊陌生 DM 連結\n"
            "• Discord 不會 DM 你要求驗證或送 Nitro\n"
            "• 啟用雙因素驗證 (2FA)\n"
            "• 輸入 `/guard features` 查看完整攔截清單\n"
            "• 懷疑時用 `/report-scam` 回報"
        ),
        color=0x5865F2,
    )
    embed.set_footer(text="MonsterGuard · Monster AI")
    await interaction.response.send_message(embed=embed)


async def setup(bot: discord.Client) -> None:
    pass