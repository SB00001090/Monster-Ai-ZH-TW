"""MonsterGuard interception capabilities — single source for user-facing copy."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class InterceptCategory:
    key: str
    title: str
    examples: str


INTERCEPT_CATEGORIES: tuple[InterceptCategory, ...] = (
    InterceptCategory(
        key="nitro",
        title="假 Nitro / Giveaway 詐騙",
        examples="免費 Nitro、Discord Gift、Steam 仿冒網域、@everyone 大量推廣連結",
    ),
    InterceptCategory(
        key="verification",
        title="假驗證 / 帳號安全詐騙",
        examples="驗證帳號、人機驗證、同步身分組、假 Discord 管理員招募表單",
    ),
    InterceptCategory(
        key="crypto",
        title="Crypto / 投資詐騙",
        examples="加倍投資、空投、錢包連結、助記詞/私鑰、MrBeast 假贈送",
    ),
    InterceptCategory(
        key="hacked_dm",
        title="被盜帳號 DM 詐騙",
        examples="「這是你嗎？」、「看看我找到的」等誘導點擊惡意連結",
    ),
    InterceptCategory(
        key="malware",
        title="惡意下載 / 遊戲詐騙",
        examples=".exe/.apk 等危險附件、免費 Robux/V-Bucks、破解版/外掛下載",
    ),
    InterceptCategory(
        key="phishing",
        title="釣魚連結",
        examples="黑名單惡意網域、Discord 仿冒網址、同形異義字網域、可疑 TLD",
    ),
    InterceptCategory(
        key="raid",
        title="Raid / 大量洗版",
        examples="重複發送相同訊息、短時間大量發文、新帳號集體洗版",
    ),
)

BEHAVIOR_SIGNALS: tuple[str, ...] = (
    "註冊未滿 1 天的新帳號發送連結",
    "註冊未滿 7 天帳號搭配可疑內容",
    "緊迫感 + 免費承諾的組合話術（限時、馬上行動等）",
)

ACTION_LEVELS: tuple[str, ...] = (
    "達警告門檻：DM 安全警告給發送者",
    "達攔截門檻：刪除訊息、通知管理員頻道、可選 mute / 隔離",
    "AI 增強：規則分數達門檻後由 Monster AI 二次分析語意",
)


def features_summary() -> str:
    """Short bullet list for embeds (Discord 1024 char field limit)."""
    lines = [f"• **{c.title}** — {c.examples}" for c in INTERCEPT_CATEGORIES]
    return "\n".join(lines)


def features_embed_description() -> str:
    """Full description for /guard features and welcome messages."""
    categories = features_summary()
    behavior = "\n".join(f"• {s}" for s in BEHAVIOR_SIGNALS)
    actions = "\n".join(f"• {s}" for s in ACTION_LEVELS)
    return (
        "MonsterGuard 會 **24/7 掃描伺服器文字頻道訊息**（需完成 `/guard setup`），"
        "並依風險分數自動警告或攔截。\n\n"
        f"**可攔截的詐騙類型：**\n{categories}\n\n"
        f"**行為風險訊號：**\n{behavior}\n\n"
        f"**攔截後動作：**\n{actions}\n\n"
        "⚠️ **目前不掃描**：私信 (DM)、語音頻道、Bot 自身訊息。"
    )