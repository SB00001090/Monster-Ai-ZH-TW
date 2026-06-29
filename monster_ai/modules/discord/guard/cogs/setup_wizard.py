"""MonsterGuard setup wizard — /guard setup."""
from __future__ import annotations

import discord

from monster_ai.modules.discord.guard.cogs.guard_group import guard_group
from monster_ai.modules.discord.guard.levels import LEVELS


class SetupView(discord.ui.View):
    def __init__(self, bot: discord.Client, guild_id: int) -> None:
        super().__init__(timeout=300)
        self.bot = bot
        self.guild_id = guild_id

    @discord.ui.select(
        placeholder="選擇保護強度",
        options=[
            discord.SelectOption(label="輕度", value="light", description="僅警告，門檻 90"),
            discord.SelectOption(label="標準", value="standard", description="刪除+警告，門檻 80（推薦）"),
            discord.SelectOption(label="嚴格", value="strict", description="刪除+mute，門檻 70"),
        ],
    )
    async def level_select(self, interaction: discord.Interaction, select: discord.ui.Select) -> None:
        level = select.values[0]
        preset = LEVELS[level]
        store = interaction.client.guild_store  # type: ignore[attr-defined]
        cfg = await store.get(self.guild_id)
        cfg.protection_level = level
        cfg.block_threshold = int(preset["block_threshold"])
        cfg.warn_threshold = int(preset["warn_threshold"])
        cfg.ai_threshold = int(preset["ai_threshold"])
        cfg.setup_complete = True
        cfg.action_mode = "mute" if level == "strict" else "delete_warn"
        await store.save(cfg)

        from monster_ai.modules.discord.guard.capabilities import INTERCEPT_CATEGORIES

        intercept_list = "\n".join(f"• {c.title}" for c in INTERCEPT_CATEGORIES)
        embed = discord.Embed(
            title="MonsterGuard 設定完成",
            description=(
                f"保護強度：**{level}**\n"
                f"攔截門檻：{cfg.block_threshold}\n"
                f"動作模式：{cfg.action_mode}\n\n"
                f"**已啟用攔截：**\n{intercept_list}\n\n"
                "使用 `/guard features` 查看詳細說明，`/guard status` 查看狀態。"
            ),
            color=0x6EE7B7,
        )
        await interaction.response.edit_message(embed=embed, view=None)


@guard_group.command(name="setup", description="啟動 MonsterGuard 設定精靈（需管理伺服器權限）")
async def guard_setup(interaction: discord.Interaction) -> None:
    try:
        if not interaction.guild:
            await interaction.response.send_message(
                "**請在伺服器頻道內使用此指令**（不要在 Bot 私信 / DM 裡輸入）。\n"
                "步驟：打開你的 Discord 伺服器 → 選任意文字頻道（如 #general）→ 輸入 `/guard setup`",
                ephemeral=True,
            )
            return
        if not interaction.user.guild_permissions.manage_guild:
            await interaction.response.send_message("需要「管理伺服器」權限。", ephemeral=True)
            return

        embed = discord.Embed(
            title="MonsterGuard 設定精靈",
            description="請選擇保護強度。完成後 MonsterGuard 將開始 24/7 保護此伺服器。",
            color=0x5865F2,
        )
        view = SetupView(interaction.client, interaction.guild.id)
        await interaction.response.send_message(embed=embed, view=view, ephemeral=True)
    except Exception:
        if not interaction.response.is_done():
            await interaction.response.send_message(
                "設定精靈啟動失敗，請確認 Bot 在線後再試。", ephemeral=True
            )
        raise


async def setup(bot: discord.Client) -> None:
    pass