"""
Catch obsolete MonsterGuard components so old message clicks never show「此交互失敗」.
"""
from __future__ import annotations

import asyncio
import logging

import discord
from discord.ext import commands

from monster_ai.modules.discord.constants import PRODUCT_NAME

logger = logging.getLogger(__name__)

STALE_MSG = (
    f"🗑️ **此介面已失效**（舊按鈕／舊選單）。\n\n"
    f"**請勿再點舊訊息。**\n"
    f"請改用 Slash 指令：\n"
    f"• `/tutorial` — 問卷導覽\n"
    f"• `/guard setup` — 設定保護\n"
    f"• `/guard cleanup-buttons` — 清除本頻道全部舊按鍵\n\n"
    f"— {PRODUCT_NAME}"
)


async def kill_stale_interaction(interaction: discord.Interaction) -> bool:
    """Respond immediately so Discord does not show 交互失敗. Returns True if ACKed."""
    try:
        from monster_ai.modules.discord.guard.interaction_utils import note_interaction

        note_interaction()
    except Exception:  # noqa: BLE001
        pass

    acked = False
    try:
        if not interaction.response.is_done():
            await interaction.response.edit_message(
                content=STALE_MSG,
                embed=None,
                view=None,
            )
            acked = True
        elif interaction.message is not None:
            await interaction.message.edit(content=STALE_MSG, embed=None, view=None)
            acked = True
        else:
            return False
    except discord.NotFound:
        logger.debug("stale ui: already 10062")
        return False
    except discord.HTTPException:
        try:
            if not interaction.response.is_done():
                await interaction.response.send_message(STALE_MSG, ephemeral=True)
                acked = True
            else:
                await interaction.followup.send(STALE_MSG, ephemeral=True)
                acked = True
        except Exception:  # noqa: BLE001
            return False

    # Prefer strip over delete (delete can fail and leave dead buttons)
    if interaction.message is not None and acked:
        try:
            # Already stripped via edit_message view=None; optional hard delete
            await interaction.message.delete()
        except Exception:  # noqa: BLE001
            pass
    return acked


class StaleButtonSink(discord.ui.View):
    """Persistent handlers for OLD tutorial button custom_ids still on Discord messages."""

    def __init__(self) -> None:
        super().__init__(timeout=None)

    @discord.ui.button(
        label="上一步",
        style=discord.ButtonStyle.secondary,
        custom_id="monster_guard:tutorial_prev",
        row=0,
    )
    async def b_prev(self, interaction: discord.Interaction, _: discord.ui.Button) -> None:
        await kill_stale_interaction(interaction)

    @discord.ui.button(
        label="下一步",
        style=discord.ButtonStyle.primary,
        custom_id="monster_guard:tutorial_next",
        row=0,
    )
    async def b_next(self, interaction: discord.Interaction, _: discord.ui.Button) -> None:
        await kill_stale_interaction(interaction)

    @discord.ui.button(
        label="跳到結尾",
        style=discord.ButtonStyle.secondary,
        custom_id="monster_guard:tutorial_skip",
        row=0,
    )
    async def b_skip(self, interaction: discord.Interaction, _: discord.ui.Button) -> None:
        await kill_stale_interaction(interaction)

    @discord.ui.button(
        label="完成 ✓",
        style=discord.ButtonStyle.success,
        custom_id="monster_guard:tutorial_done",
        row=0,
    )
    async def b_done(self, interaction: discord.Interaction, _: discord.ui.Button) -> None:
        await kill_stale_interaction(interaction)


class StaleUICog(commands.Cog):
    """Catch-all for unmatched monster_guard:* components (e.g. old dynamic quiz ids)."""

    def __init__(self, bot: discord.Client) -> None:
        self.bot = bot

    @commands.Cog.listener()
    async def on_interaction(self, interaction: discord.Interaction) -> None:
        if interaction.type is not discord.InteractionType.component:
            return
        # Already handled by a View callback
        if interaction.response.is_done():
            return

        data = interaction.data or {}
        cid = str(data.get("custom_id") or "")
        if not cid.startswith("monster_guard:"):
            return

        # SetupLevelView owns setup_level — if still not done, treat as orphan stale
        # (e.g. bot reloaded mid-click). Prefer safe kill over 交互失敗.
        if cid == "monster_guard:setup_level":
            # Let SetupLevelView callback run first on same event loop tick
            await asyncio.sleep(0)
            if interaction.response.is_done():
                return
            await kill_stale_interaction(interaction)
            return

        # Orphan / obsolete UI (old buttons, dynamic quiz ids, etc.)
        if cid.startswith("monster_guard:"):
            await kill_stale_interaction(interaction)


async def setup(bot: discord.Client) -> None:
    bot.add_view(StaleButtonSink())
    await bot.add_cog(StaleUICog(bot))
    logger.info("Stale UI handlers ready (old buttons → safe message, no 交互失敗)")
