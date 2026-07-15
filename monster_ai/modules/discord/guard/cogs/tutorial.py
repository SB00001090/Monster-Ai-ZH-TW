"""MonsterGuard 問卷式教程 — 僅下拉選單，啟動時清除全部舊按鍵。"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import discord
from discord import app_commands

from monster_ai.modules.discord.constants import NEON_COLORS, PRODUCT_NAME, VERSION
from monster_ai.modules.discord.guard.button_cleanup import (
    MessageRegistry,
    delete_or_strip_by_id,
    purge_channel_ui_messages,
)
from monster_ai.modules.discord.guard.cogs.guard_group import guard_group
from monster_ai.modules.discord.guard.interaction_utils import (
    note_interaction,
    safe_defer,
    safe_edit_message,
    safe_followup,
)
from monster_ai.modules.discord.guard.tutorial_content import (
    QUESTIONNAIRE,
    get_question,
    question_count,
)

logger = logging.getLogger(__name__)

# Old button + select custom ids to purge from history
UI_TITLE_KW = (
    "自動教程",
    "問卷",
    "教程",
    "設定精靈",
    "MonsterGuard 設定",
    "tutorial_step=",
    "問卷導覽",
)
UI_CID_PREFIXES = (
    "monster_guard:tutorial",
    "monster_guard:setup",
    "monster_guard:quiz",
)

_REGISTRY: MessageRegistry | None = None


def _registry() -> MessageRegistry:
    global _REGISTRY
    if _REGISTRY is None:
        _REGISTRY = MessageRegistry(Path("data/guard/ui_messages.json"), kind="tutorial")
    return _REGISTRY


def _scope_key(guild_id: int | None, channel_id: int | None) -> int:
    if guild_id:
        return int(guild_id)
    return -int(channel_id or 0)


async def purge_all_old_ui(
    bot: discord.Client,
    *,
    scope: int,
    channel: discord.abc.Messageable | None,
    keep_message_id: int | None = None,
) -> dict[str, int]:
    """Delete ALL tracked + history-scanned tutorial/setup component messages."""
    reg = _registry()
    stats = {"deleted": 0, "stripped": 0, "failed": 0, "tracked": 0, "scanned": 0}

    for ch_id, mid in reg.list_messages(scope):
        if keep_message_id and mid == keep_message_id:
            continue
        stats["tracked"] += 1
        r = await delete_or_strip_by_id(
            bot,
            ch_id,
            mid,
            reason="🗑️ 舊介面已清除 — 請用 `/tutorial` 問卷",
        )
        stats[r] = stats.get(r, 0) + 1

    if channel is not None and bot.user is not None:
        hist = await purge_channel_ui_messages(
            channel,
            bot.user,
            title_keywords=UI_TITLE_KW,
            custom_id_prefixes=UI_CID_PREFIXES,
            limit=100,
            keep_message_id=keep_message_id,
            reason="🗑️ 舊按鍵/選單已清除 — 請用 `/tutorial` 問卷式導覽",
        )
        for k in ("deleted", "stripped", "failed", "scanned"):
            stats[k] = stats.get(k, 0) + int(hist.get(k, 0))

    if keep_message_id and channel is not None and getattr(channel, "id", None):
        reg.clear_scope(scope)
        reg.add_and_set_active(scope, int(channel.id), keep_message_id)  # type: ignore[arg-type]
    else:
        reg.clear_scope(scope)
    return stats


def build_question_embed(index: int, *, answers: dict[str, str] | None = None) -> discord.Embed:
    q = get_question(index)
    total = question_count()
    desc = q.prompt
    if answers:
        lines = [f"• {k}: `{v}`" for k, v in answers.items()]
        desc += "\n\n**已作答：**\n" + "\n".join(lines[-5:])
    embed = discord.Embed(
        title=f"📋 {PRODUCT_NAME} 問卷 · {q.title}",
        description=desc,
        color=NEON_COLORS["cyan"],
    )
    embed.set_footer(
        text=f"問卷 {index + 1}/{total} · 請用下方下拉選單作答 · 無按鈕 · v{VERSION}"
    )
    return embed


class QuizSelect(discord.ui.Select):
    def __init__(self, parent: "QuestionnaireView") -> None:
        q = get_question(parent.index)
        options = [
            discord.SelectOption(
                label=opt.label[:100],
                value=opt.value,
                description=(opt.description or "")[:100],
            )
            for opt in q.options
        ]
        super().__init__(
            placeholder="請選擇一個答案…",
            min_values=1,
            max_values=1,
            options=options,
            # No custom_id → discord.py assigns ephemeral id for this message only.
            # After bot restart, unhandled old selects are killed by stale_ui sink.
        )
        self.parent_view = parent

    async def callback(self, interaction: discord.Interaction) -> None:
        note_interaction()
        parent = self.parent_view
        choice = self.values[0]
        q = get_question(parent.index)
        reply = q.replies.get(choice, "已記錄。")
        parent.answers[q.key] = choice

        next_index = parent.index + 1
        finished = next_index >= question_count() or choice == "done_ok"

        if finished or choice == "done_ok":
            embed = discord.Embed(
                title=f"✅ {PRODUCT_NAME} 問卷完成",
                description=reply,
                color=NEON_COLORS["green"],
            )
            if parent.answers:
                summary = "\n".join(f"• **{k}**: `{v}`" for k, v in parent.answers.items())
                embed.add_field(name="你的回答", value=summary[:1000], inline=False)
            embed.set_footer(text=f"無殘留按鈕 · {PRODUCT_NAME} v{VERSION}")
            if not await safe_edit_message(interaction, embed=embed, view=None):
                return
            parent.stop()
            scope = _scope_key(interaction.guild_id, interaction.channel_id)
            if interaction.message:
                _registry().mark_inactive(scope, interaction.message.id)
            try:
                await parent._mark_complete(interaction)
            except Exception:  # noqa: BLE001
                pass
            return

        if q.key == "commands" and choice != "cmd_old":
            embed = build_question_embed(parent.index, answers=parent.answers)
            embed.add_field(name="回饋", value=reply, inline=False)
            new_view = QuestionnaireView(parent.index, parent.answers, parent.nonce)
            await safe_edit_message(interaction, embed=embed, view=new_view)
            return

        if choice == "done_role":
            next_index = 0
        elif choice == "done_setup":
            next_index = 1

        parent.index = next_index
        embed = build_question_embed(next_index, answers=parent.answers)
        embed.add_field(name="上一題回饋", value=reply, inline=False)
        new_view = QuestionnaireView(next_index, parent.answers, parent.nonce)
        if not await safe_edit_message(interaction, embed=embed, view=new_view):
            logger.warning("quiz select expired (10062)")


class QuestionnaireView(discord.ui.View):
    """Timeout view with ONE select — no buttons. Strips self on timeout."""

    def __init__(
        self,
        index: int = 0,
        answers: dict[str, str] | None = None,
        nonce: str | None = None,
    ) -> None:
        super().__init__(timeout=600)
        self.index = max(0, min(question_count() - 1, index))
        self.answers = dict(answers or {})
        self.nonce = nonce or discord.utils.utcnow().strftime("%H%M%S")
        self.message: discord.Message | None = None
        self.add_item(QuizSelect(self))

    async def on_timeout(self) -> None:
        if self.message is None:
            return
        try:
            await self.message.edit(
                content="⏱️ 問卷已逾時關閉（已移除選單）。重新開始：`/tutorial`",
                embed=None,
                view=None,
            )
        except Exception:  # noqa: BLE001
            try:
                await self.message.edit(view=None)
            except Exception:  # noqa: BLE001
                pass

    async def _mark_complete(self, interaction: discord.Interaction) -> None:
        guild_id = interaction.guild_id
        if not guild_id:
            return
        store = getattr(interaction.client, "guild_store", None)
        if store is None:
            return
        try:
            cfg = await store.get(guild_id)
            cfg.tutorial_complete = True
            await store.save(cfg)
        except Exception as exc:  # noqa: BLE001
            logger.debug("quiz complete flag: %s", exc)


def questionnaire_view(index: int = 0) -> QuestionnaireView:
    return QuestionnaireView(index=index)


async def find_tutorial_channel(guild: discord.Guild) -> discord.TextChannel | None:
    me = guild.me
    if guild.system_channel and me:
        perms = guild.system_channel.permissions_for(me)
        if perms.send_messages and perms.embed_links:
            return guild.system_channel
    if me is None:
        return None
    for ch in guild.text_channels:
        perms = ch.permissions_for(me)
        if perms.send_messages and perms.embed_links:
            return ch
    return None


async def send_auto_tutorial(
    bot: discord.Client,
    guild: discord.Guild,
    *,
    force: bool = False,
    reason: str = "auto",
) -> bool:
    store = getattr(bot, "guild_store", None)
    if store is not None and not force:
        try:
            cfg = await store.get(guild.id)
            if cfg.tutorial_auto_sent and cfg.tutorial_complete:
                return False
            if cfg.tutorial_auto_sent and reason == "guild_join":
                return False
        except Exception:  # noqa: BLE001
            pass

    channel = await find_tutorial_channel(guild)
    if channel is None:
        return False

    await purge_all_old_ui(bot, scope=guild.id, channel=channel)

    embed = build_question_embed(0)
    embed.description = (
        f"**自動問卷**（{reason}）· 已清除本頻道全部舊按鍵/選單\n\n"
        + (embed.description or "")
    )
    view = questionnaire_view(0)
    try:
        msg = await channel.send(embed=embed, view=view)
    except Exception as exc:  # noqa: BLE001
        logger.warning("auto quiz failed: %s", exc)
        return False
    view.message = msg
    _registry().add_and_set_active(guild.id, msg.channel.id, msg.id)

    if store is not None:
        try:
            cfg = await store.get(guild.id)
            cfg.tutorial_auto_sent = True
            await store.save(cfg)
        except Exception:  # noqa: BLE001
            pass
    return True


async def _start_manual_quiz(interaction: discord.Interaction) -> None:
    if not await safe_defer(interaction):
        return

    scope = _scope_key(interaction.guild_id, interaction.channel_id)
    stats = await purge_all_old_ui(
        interaction.client,
        scope=scope,
        channel=interaction.channel,
    )

    embed = build_question_embed(0)
    embed.description = (
        f"🗑️ 已清除舊介面：刪 `{stats.get('deleted', 0)}` · "
        f"作廢 `{stats.get('stripped', 0)}` · 掃描 `{stats.get('scanned', 0)}`\n\n"
        + (embed.description or "")
    )
    view = questionnaire_view(0)
    try:
        msg = await interaction.followup.send(embed=embed, view=view, wait=True)
    except Exception as exc:  # noqa: BLE001
        await safe_followup(interaction, f"開啟問卷失敗：{exc}")
        return
    view.message = msg
    _registry().add_and_set_active(scope, msg.channel.id, msg.id)


@guard_group.command(name="tutorial", description="問卷式導覽（自動清除全部舊按鍵）")
async def guard_tutorial(interaction: discord.Interaction) -> None:
    await _start_manual_quiz(interaction)


@guard_group.command(name="tutorial-clear", description="清除本頻道全部舊教程/按鈕（不開新問卷）")
async def guard_tutorial_clear(interaction: discord.Interaction) -> None:
    if not await safe_defer(interaction):
        return
    scope = _scope_key(interaction.guild_id, interaction.channel_id)
    stats = await purge_all_old_ui(
        interaction.client, scope=scope, channel=interaction.channel
    )
    await safe_followup(
        interaction,
        (
            f"🗑️ **已清除全部舊按鍵/選單**\n"
            f"刪除 `{stats.get('deleted', 0)}` · 作廢 `{stats.get('stripped', 0)}` · "
            f"掃描 `{stats.get('scanned', 0)}`\n"
            f"重新開始：`/tutorial`"
        ),
    )


@guard_group.command(name="cleanup-buttons", description="清除本頻道全部舊按鍵（教程+設定）")
async def guard_cleanup_buttons(interaction: discord.Interaction) -> None:
    if not await safe_defer(interaction):
        return
    scope = _scope_key(interaction.guild_id, interaction.channel_id)
    stats = await purge_all_old_ui(
        interaction.client, scope=scope, channel=interaction.channel
    )
    try:
        from monster_ai.modules.discord.guard.cogs import setup_wizard as sw

        if interaction.guild_id:
            await sw.retire_previous_setup(interaction.client, interaction.guild_id)
    except Exception:  # noqa: BLE001
        pass
    await safe_followup(
        interaction,
        (
            f"🧹 **已清除全部舊按鍵**\n"
            f"刪 `{stats.get('deleted', 0)}` / 作廢 `{stats.get('stripped', 0)}` / "
            f"掃描 `{stats.get('scanned', 0)}`\n\n"
            f"新流程：**問卷** `/tutorial` · **設定** `/guard setup`"
        ),
    )


@app_commands.command(name="tutorial", description="MonsterGuard 問卷式導覽（清舊按鍵）")
async def tutorial_cmd(interaction: discord.Interaction) -> None:
    await _start_manual_quiz(interaction)


async def setup(bot: discord.Client) -> None:
    # Do NOT add_view persistent buttons — questionnaire uses ephemeral timeout views only
    try:
        bot.tree.add_command(tutorial_cmd, override=True)
    except Exception:  # noqa: BLE001
        pass
    logger.info(
        "MonsterGuard questionnaire tutorial registered (%s questions, no buttons)",
        question_count(),
    )
