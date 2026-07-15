"""Neon cyberpunk Discord embed builders — MonsterGuard v2.1（繁體中文）."""
from __future__ import annotations

from typing import Any

import discord

from monster_ai.modules.discord.constants import DEVELOPER_CREDIT, NEON_COLORS, PRODUCT_NAME, VERSION

_ANIM_FRAMES = ("◢◤", "◥◣", "▰▱", "▱▰")


def _yn(val: bool) -> str:
    return "是" if val else "否"


_TODDLER_STAGE_ZH = {
    "infant": "嬰兒期",
    "toddler": "幼兒期",
    "preschool": "學前",
    "school": "就學期",
}

_CONN_POLICY_ZH = {
    "tunnel_or_usb_only": "僅 Tunnel / USB（無 Tailscale）",
}


def _guardian_field_value(g: dict[str, Any]) -> str:
    """Human-readable Guardian Ai block for /status embeds."""
    if not g:
        return "狀態：`無法讀取`（請確認 :7860 `/api/guardian/status`）"

    toddler = g.get("toddler_learning") or {}
    stage_raw = str(toddler.get("stage") or "—")
    stage = _TODDLER_STAGE_ZH.get(stage_raw, stage_raw)
    next_hint = toddler.get("next_stage") or "—"

    curr = g.get("curriculum") or {}
    phase = curr.get("current_phase") or "—"
    topic = curr.get("current_topic_id") or "—"
    progress = curr.get("progress_pct")
    progress_txt = f"{progress}%" if progress is not None else "—"

    policy_raw = str(g.get("connection_policy") or "tunnel_or_usb_only")
    policy = _CONN_POLICY_ZH.get(policy_raw, policy_raw)
    mode = g.get("connection_mode") or "—"

    healthy = g.get("healthy")
    health_txt = "健康" if healthy is True else ("異常" if healthy is False else "—")

    return (
        f"啟用：`{_yn(bool(g.get('enabled')))}` · {health_txt}\n"
        f"成長階段：`{stage}`\n"
        f"下一階段：`{next_hint}`\n"
        f"課程：`{phase}` · `{topic}` · {progress_txt}\n"
        f"遠端政策：`{policy}`\n"
        f"模式：`{mode}`"
    )


def neon_footer(frame_idx: int = 0) -> str:
    pulse = _ANIM_FRAMES[frame_idx % len(_ANIM_FRAMES)]
    return f"{pulse} {PRODUCT_NAME} v{VERSION} · {DEVELOPER_CREDIT}"


def status_embed(
    *,
    connected: bool,
    resilience: dict[str, Any] | None = None,
    monster_ai: dict[str, Any] | None = None,
    guardian: dict[str, Any] | None = None,
    guard_stats: dict[str, Any] | None = None,
    frame_idx: int = 0,
) -> discord.Embed:
    color = NEON_COLORS["green"] if connected else NEON_COLORS["alert"]
    state_zh = "在線" if connected else "離線 / 重連中"
    title = f"{'🟢' if connected else '🔴'} {PRODUCT_NAME} 狀態"
    embed = discord.Embed(title=title, color=color)
    embed.description = f"```ansi\n\u001b[0;36m{state_zh}\u001b[0m\n```"

    res = resilience or {}
    hb = res.get("heartbeat_ok")
    hb_text = "正常" if hb is True else ("異常" if hb is False else "—")
    embed.add_field(
        name="防斷線",
        value=(
            f"重試：`{res.get('reconnect_attempts', 0)}/{res.get('max_attempts', 10)}`\n"
            f"待機模式：`{_yn(bool(res.get('standby_mode')))}`\n"
            f"心跳：`{hb_text}`"
        ),
        inline=True,
    )

    ai = monster_ai or {}
    consent = "已授權" if ai.get("consent") else "待授權"
    linked = "已連線" if ai.get("connected") else "未連線"
    embed.add_field(
        name="Monster AI",
        value=(
            f"連線：`{linked}`\n"
            f"同意：`{consent}`\n"
            f"後端：`{ai.get('backend', 'local')}`"
        ),
        inline=True,
    )

    embed.add_field(
        name="Guardian Ai",
        value=_guardian_field_value(guardian or {}),
        inline=True,
    )

    if guard_stats:
        embed.add_field(name="伺服器數", value=str(guard_stats.get("guilds", 0)), inline=True)
        embed.add_field(name="已掃描", value=str(guard_stats.get("scanned", 0)), inline=True)
        embed.add_field(name="規則版本", value=str(guard_stats.get("rules_version", "?")), inline=True)

    embed.set_footer(text=neon_footer(frame_idx))
    return embed


def about_embed() -> discord.Embed:
    embed = discord.Embed(
        title=f"{PRODUCT_NAME} v{VERSION}",
        description=(
            "**Monster AI 生態 Discord 橋樑**\n\n"
            "• 反詐騙訊息掃描\n"
            "• 本地 LLM 對話（`/ai`、`/chat`）\n"
            "• Guardian Ai 雲端同步與幼兒式學習\n"
            "• 防斷線自修復（10 次重試 + 心跳）\n"
            "• 監控指令（`/status`、`/guard restart`）\n"
            "• Monster AI 動態自我介紹（`/intro`、`/monsterai`）\n"
            "• 新成員歡迎與個性化介紹\n"
            "• **自動教程**（加入伺服器 / 設定後 / `/guard tutorial`）\n\n"
            "🔒 本地優先 · 零信任 · 連線 Monster AI 需用戶同意"
        ),
        color=NEON_COLORS["cyan"],
    )
    embed.set_footer(text=DEVELOPER_CREDIT)
    return embed


def alert_embed(
    title: str,
    description: str,
    *,
    level: str = "warn",
) -> discord.Embed:
    colors = {"info": NEON_COLORS["cyan"], "warn": NEON_COLORS["magenta"], "critical": NEON_COLORS["alert"]}
    embed = discord.Embed(title=title, description=description, color=colors.get(level, NEON_COLORS["magenta"]))
    embed.set_footer(text=neon_footer())
    return embed


def intro_embed(
    description: str,
    *,
    style: str = "guardian",
    color: int | None = None,
    title: str = "Monster AI · 自我介紹",
) -> discord.Embed:
    style_labels = {
        "guardian": "🛡️ 正式守衛者",
        "cyberpunk": "◢◤ 幽默 Cyberpunk",
        "privacy": "🔒 隱私守護者",
    }
    embed = discord.Embed(
        title=title,
        description=description,
        color=color or NEON_COLORS.get("cyan", 0x00F5FF),
    )
    embed.set_author(name=f"Monster AI — {style_labels.get(style, style)}")
    embed.set_footer(text=neon_footer())
    return embed


