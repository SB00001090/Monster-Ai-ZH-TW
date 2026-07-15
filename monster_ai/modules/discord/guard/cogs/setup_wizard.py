"""MonsterGuard setup wizard — /guard setup (public, auto-delete old menus)."""
from __future__ import annotations

import asyncio
import logging
import secrets
import time
from typing import Any

import discord

from monster_ai.modules.discord.guard.capabilities import INTERCEPT_CATEGORIES
from monster_ai.modules.discord.guard.cogs.guard_group import guard_group
from monster_ai.modules.discord.guard.levels import LEVELS

logger = logging.getLogger(__name__)

LEVEL_LABELS = {"light": "輕度", "standard": "標準", "strict": "嚴格"}
SETUP_SELECT_CUSTOM_ID = "monster_guard:setup_level"
SETUP_TIMEOUT_SEC = 300

# guild_id -> (channel_id, message_id, token, created_monotonic)
_active_setups: dict[int, tuple[int, int, str, float]] = {}
# message_id -> guild_id (fast stale checks)
_message_to_guild: dict[int, int] = {}


async def _retire_setup_message(
    bot: discord.Client,
    channel_id: int,
    message_id: int,
) -> None:
    """Delete old setup menu; fallback to stripping components."""
    channel: Any = bot.get_channel(channel_id)
    if channel is None:
        try:
            channel = await bot.fetch_channel(channel_id)
        except Exception:  # noqa: BLE001
            return
    try:
        msg = await channel.fetch_message(message_id)
    except Exception:  # noqa: BLE001
        return

    try:
        await msg.delete()
        logger.info("Deleted obsolete setup menu message=%s", message_id)
        return
    except discord.Forbidden:
        pass
    except Exception as exc:  # noqa: BLE001
        logger.debug("Setup menu delete failed: %s", exc)

    try:
        await msg.edit(
            content="🗑️ **舊設定選單已作廢** — 請使用最新的 `/guard setup`。",
            embed=None,
            view=None,
        )
    except Exception as exc:  # noqa: BLE001
        logger.debug("Setup menu invalidate failed: %s", exc)


def _clear_guild(guild_id: int) -> tuple[int, int, str, float] | None:
    prev = _active_setups.pop(guild_id, None)
    if prev:
        _message_to_guild.pop(prev[1], None)
    return prev


async def retire_previous_setup(bot: discord.Client, guild_id: int) -> None:
    prev = _clear_guild(guild_id)
    if not prev:
        return
    channel_id, message_id, _token, _ts = prev
    await _retire_setup_message(bot, channel_id, message_id)


def register_setup(guild_id: int, channel_id: int, message_id: int, token: str) -> None:
    old = _active_setups.get(guild_id)
    if old:
        _message_to_guild.pop(old[1], None)
    _active_setups[guild_id] = (channel_id, message_id, token, time.monotonic())
    _message_to_guild[message_id] = guild_id


def _active_entry(guild_id: int) -> tuple[int, int, str, float] | None:
    entry = _active_setups.get(guild_id)
    if not entry:
        return None
    _ch, _mid, _tok, created = entry
    if time.monotonic() - created > SETUP_TIMEOUT_SEC:
        _clear_guild(guild_id)
        return None
    return entry


class SetupLevelView(discord.ui.View):
    """Persistent view: handles clicks even after bot restart (stale → clear message)."""

    def __init__(self) -> None:
        super().__init__(timeout=None)

    @discord.ui.select(
        custom_id=SETUP_SELECT_CUSTOM_ID,
        placeholder="選擇保護強度",
        min_values=1,
        max_values=1,
        options=[
            discord.SelectOption(label="輕度", value="light", description="僅警告，門檻 90"),
            discord.SelectOption(
                label="標準", value="standard", description="刪除+警告，門檻 80（推薦）"
            ),
            discord.SelectOption(label="嚴格", value="strict", description="刪除+mute，門檻 70"),
        ],
    )
    async def level_select(
        self, interaction: discord.Interaction, select: discord.ui.Select
    ) -> None:
        # ACK first with edit_message (one RTT) — never wait on DB before ACK
        guild_id = interaction.guild_id or 0
        msg = interaction.message
        msg_id = msg.id if msg else 0
        entry = _active_entry(guild_id)
        valid = bool(entry and entry[1] == msg_id)
        level = select.values[0] if select.values else "standard"

        if not valid:
            try:
                await interaction.response.edit_message(
                    content=(
                        "🗑️ **此選單已作廢**（舊選單）。\n"
                        "請重新執行 `/guard setup`。"
                    ),
                    embed=None,
                    view=None,
                )
            except discord.NotFound:
                return
            except Exception:  # noqa: BLE001
                try:
                    await interaction.response.send_message(
                        "🗑️ 此選單已作廢，請重新 `/guard setup`。",
                        ephemeral=True,
                    )
                except Exception:  # noqa: BLE001
                    return
            if msg is not None:
                try:
                    await msg.delete()
                except Exception:  # noqa: BLE001
                    pass
            if msg_id:
                gid = _message_to_guild.pop(msg_id, None)
                if gid is not None:
                    cur = _active_setups.get(gid)
                    if cur and cur[1] == msg_id:
                        _active_setups.pop(gid, None)
            return

        # Valid: strip select immediately so double-click cannot fire
        try:
            from monster_ai.modules.discord.guard.interaction_utils import note_interaction

            note_interaction()
            await interaction.response.edit_message(
                content="⏳ 正在儲存設定…",
                embed=None,
                view=None,
            )
        except discord.NotFound:
            return
        except Exception as exc:  # noqa: BLE001
            logger.warning("setup ACK failed: %s", exc)
            return

        preset = LEVELS.get(level) or LEVELS["standard"]
        try:
            store = interaction.client.guild_store  # type: ignore[attr-defined]
            cfg = await store.get(guild_id)
            cfg.protection_level = level
            cfg.block_threshold = int(preset["block_threshold"])
            cfg.warn_threshold = int(preset["warn_threshold"])
            cfg.ai_threshold = int(preset["ai_threshold"])
            cfg.setup_complete = True
            cfg.action_mode = "mute" if level == "strict" else "delete_warn"
            await store.save(cfg)

            intercept_list = "\n".join(f"• {c.title}" for c in INTERCEPT_CATEGORIES)
            level_label = LEVEL_LABELS.get(level, level)

            embed = discord.Embed(
                title="🛡️ MonsterGuard 已啟用",
                description=(
                    f"此伺服器已由 **MonsterGuard** 24/7 守護。\n\n"
                    f"保護強度：**{level_label}** (`{level}`)\n"
                    f"攔截門檻：{cfg.block_threshold}\n"
                    f"動作模式：{cfg.action_mode}\n"
                    f"設定者：{interaction.user.mention}\n\n"
                    f"**已啟用攔截：**\n{intercept_list}\n\n"
                    "使用 `/guard features` · `/guard status` · 問卷 `/tutorial`"
                ),
                color=0x6EE7B7,
            )
            embed.set_footer(text="MonsterGuard · Monster AI · 此訊息全頻道可見")
            await interaction.edit_original_response(content=None, embed=embed, view=None)
            _clear_guild(guild_id)

            try:
                guard_s = getattr(interaction.client, "guard_settings", None)
                if (
                    guard_s is not None
                    and getattr(guard_s, "auto_tutorial_enabled", True)
                    and getattr(guard_s, "auto_tutorial_on_setup", True)
                    and interaction.guild is not None
                ):
                    from monster_ai.modules.discord.guard.cogs.tutorial import send_auto_tutorial

                    # Background — do not block interaction path further
                    interaction.client.loop.create_task(  # type: ignore[union-attr]
                        send_auto_tutorial(
                            interaction.client,
                            interaction.guild,
                            force=False,
                            reason="setup_complete",
                        )
                    )
            except Exception as tut_exc:  # noqa: BLE001
                logger.debug("post-setup tutorial skip: %s", tut_exc)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Setup level_select failed: %s", exc)
            try:
                await interaction.edit_original_response(
                    content=f"設定儲存失敗：`{exc}`\n請再執行 `/guard setup`。",
                    embed=None,
                    view=None,
                )
            except Exception:  # noqa: BLE001
                pass
            _clear_guild(guild_id)


@guard_group.command(name="setup", description="啟動 MonsterGuard 設定精靈（需管理伺服器權限）")
async def guard_setup(interaction: discord.Interaction) -> None:
    from monster_ai.modules.discord.guard.interaction_utils import safe_followup, safe_respond

    try:
        if not interaction.guild:
            await safe_respond(
                interaction,
                "**請在伺服器頻道內使用此指令**（不要在 Bot 私信 / DM 裡輸入）。\n"
                "步驟：打開你的 Discord 伺服器 → 選任意文字頻道（如 #general）→ 輸入 `/guard setup`",
            )
            return
        if not interaction.user.guild_permissions.manage_guild:
            await safe_respond(interaction, "需要「管理伺服器」權限。")
            return

        # Pop old registry first (sync) — delete Discord message in background after ACK
        prev = _clear_guild(interaction.guild.id)

        token = secrets.token_hex(8)
        embed = discord.Embed(
            title="MonsterGuard 設定精靈",
            description=(
                "請選擇保護強度。完成後 MonsterGuard 將開始 24/7 保護此伺服器。\n\n"
                "📢 此訊息為**公開**，全頻道成員可見。\n"
                "🗑️ 每次重新 `/guard setup` 會**自動刪除舊選單**，避免點錯。\n"
                "⏱️ 選單 **5 分鐘**後自動作廢；點舊選單會提示作廢並移除。"
            ),
            color=0x5865F2,
        )
        view = SetupLevelView()
        # Respond immediately (must be within 3s — do not await network deletes first)
        ok = await safe_respond(interaction, embed=embed, view=view)
        if not ok:
            return
        msg = await interaction.original_response()
        register_setup(interaction.guild.id, msg.channel.id, msg.id, token)

        bot = interaction.client

        async def _cleanup_old() -> None:
            if prev:
                channel_id, message_id, _tok, _ts = prev
                await _retire_setup_message(bot, channel_id, message_id)
            # Scan channel history — delete ALL old setup menus with buttons
            try:
                from monster_ai.modules.discord.guard.button_cleanup import (
                    purge_channel_ui_messages,
                )

                ch = interaction.channel
                if ch is not None and bot.user is not None:
                    await purge_channel_ui_messages(
                        ch,
                        bot.user,
                        title_keywords=("設定精靈", "MonsterGuard 設定"),
                        custom_id_prefixes=("monster_guard:setup",),
                        limit=50,
                        keep_message_id=msg.id,
                        reason="🗑️ 舊設定選單已清除 — 請用最新的 `/guard setup`",
                    )
            except Exception as exc:  # noqa: BLE001
                logger.debug("setup channel purge: %s", exc)

        async def _expire() -> None:
            await asyncio.sleep(SETUP_TIMEOUT_SEC)
            entry = _active_setups.get(interaction.guild.id)  # type: ignore[union-attr]
            if not (entry and entry[1] == msg.id):
                return
            try:
                await msg.delete()
            except Exception:  # noqa: BLE001
                try:
                    await msg.edit(
                        content="⏱️ **設定選單已逾時作廢**。請重新 `/guard setup`。",
                        embed=None,
                        view=None,
                    )
                except Exception:  # noqa: BLE001
                    pass
            _clear_guild(interaction.guild.id)  # type: ignore[union-attr]

        bot.loop.create_task(_cleanup_old())  # type: ignore[union-attr]
        bot.loop.create_task(_expire())  # type: ignore[union-attr]
    except discord.NotFound:
        logger.warning("guard setup: interaction expired before response")
    except Exception:
        try:
            await safe_followup(interaction, "設定精靈啟動失敗，請確認 Bot 在線後再試。")
        except Exception:  # noqa: BLE001
            pass
        raise


async def setup(bot: discord.Client) -> None:
    # Register persistent select handler (survives restarts for stale-menu UX)
    bot.add_view(SetupLevelView())
    logger.info("MonsterGuard setup select view registered (custom_id=%s)", SETUP_SELECT_CUSTOM_ID)
