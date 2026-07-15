"""MonsterGuard questionnaire tutorial (問卷式，無按鈕)."""
from __future__ import annotations

from dataclasses import dataclass

from monster_ai.modules.discord.constants import DEVELOPER_CREDIT, PRODUCT_NAME, VERSION


@dataclass(frozen=True)
class QuizOption:
    label: str
    value: str
    description: str = ""


@dataclass(frozen=True)
class QuizQuestion:
    key: str
    title: str
    prompt: str
    options: tuple[QuizOption, ...]
    """value -> follow-up tip shown after selection"""
    replies: dict[str, str]


# 問卷題目（下拉選擇，不用按鈕）
QUESTIONNAIRE: tuple[QuizQuestion, ...] = (
    QuizQuestion(
        key="role_order",
        title="Q1 · 角色順序",
        prompt=(
            f"歡迎 **{PRODUCT_NAME} v{VERSION}** 問卷導覽（約 1 分鐘）。\n\n"
            "伺服器設定 → 角色 → **MonsterGuard 是否高於一般成員**？\n"
            "（否則無法刪除詐騙訊息）"
        ),
        options=(
            QuizOption("是，已調整", "role_ok", "角色已正確"),
            QuizOption("還沒", "role_no", "請先調整角色"),
            QuizOption("不確定", "role_unsure", "建議現在去確認"),
        ),
        replies={
            "role_ok": "✅ 很好。角色夠高才能刪訊息。",
            "role_no": "⚠️ 請立刻調整角色順序，否則攔截會失敗。",
            "role_unsure": "👉 伺服器設定 → 角色 → 把 MonsterGuard 拖到成員上方。",
        },
    ),
    QuizQuestion(
        key="setup_done",
        title="Q2 · 是否完成設定",
        prompt="是否已在本伺服器執行過 **`/guard setup`** 並選好保護強度？",
        options=(
            QuizOption("已完成", "setup_yes", "設定完成"),
            QuizOption("還沒", "setup_no", "需要 setup"),
            QuizOption("不知道怎麼做", "setup_help", "需要說明"),
        ),
        replies={
            "setup_yes": "✅ 設定完成後才會開始 24/7 掃描。",
            "setup_no": "👉 請在**文字頻道**執行 `/guard setup`（不要用私信）。",
            "setup_help": (
                "步驟：任意文字頻道 → 輸入 `/guard setup` → 選 **標準**（推薦）。\n"
                "重新執行會自動清掉舊設定選單。"
            ),
        },
    ),
    QuizQuestion(
        key="goal",
        title="Q3 · 主要用途",
        prompt="你最想先用哪個功能？",
        options=(
            QuizOption("防詐騙攔截", "goal_guard", "反詐"),
            QuizOption("本機 AI 對話", "goal_chat", "AI"),
            QuizOption("自主學習課程", "goal_learn", "學習"),
            QuizOption("全部都要", "goal_all", "全功能"),
        ),
        replies={
            "goal_guard": "📌 指令：`/guard status` · `/guard features` · `/report-scam`",
            "goal_chat": "📌 指令：`/chat` · `/ai`（需本機 Monster AI 已授權連線）",
            "goal_learn": "📌 指令：`/ailearn` · `/aistatus` · `/learn`",
            "goal_all": (
                "📌 建議順序：`/guard setup` → `/guard status` → `/chat` → `/ailearn`"
            ),
        },
    ),
    QuizQuestion(
        key="commands",
        title="Q4 · 常用指令確認",
        prompt="以下哪個**不是**建議日常使用的指令？",
        options=(
            QuizOption("/guard status — 看狀態", "cmd_status", "這是建議的"),
            QuizOption("/tutorial — 重開問卷", "cmd_tut", "這是建議的"),
            QuizOption("點舊訊息上的過期按鈕", "cmd_old", "不要這樣做"),
            QuizOption("/guard features — 攔截清單", "cmd_feat", "這是建議的"),
        ),
        replies={
            "cmd_status": "其實這是正確指令 😄 請選「點舊訊息上的過期按鈕」。",
            "cmd_tut": "其實這是正確指令 😄 請選「點舊訊息上的過期按鈕」。",
            "cmd_old": (
                "✅ 正確！**不要點舊按鈕**。\n"
                "一律重新 `/tutorial` 或 `/guard setup`，系統會清掉舊介面。"
            ),
            "cmd_feat": "其實這是正確指令 😄 請選「點舊訊息上的過期按鈕」。",
        },
    ),
    QuizQuestion(
        key="done",
        title="Q5 · 完成",
        prompt=(
            "最後確認：是否已了解「只使用最新 slash 指令、不要點舊按鈕」？"
        ),
        options=(
            QuizOption("了解，完成問卷", "done_ok", "完成"),
            QuizOption("再看一次權限說明", "done_role", "重看角色"),
            QuizOption("再看 setup 說明", "done_setup", "重看 setup"),
        ),
        replies={
            "done_ok": (
                f"🎉 **問卷完成！**\n\n"
                f"下一步：\n"
                f"1. `/guard setup`（若未設定）\n"
                f"2. `/guard status`\n"
                f"3. `/guard cleanup-buttons`（清殘留舊按鍵）\n\n"
                f"— {DEVELOPER_CREDIT}"
            ),
            "done_role": (
                "角色：伺服器設定 → 角色 → MonsterGuard **高於**一般成員，"
                "並具管理訊息權限。"
            ),
            "done_setup": (
                "在文字頻道執行 `/guard setup` → 選標準 → 完成後用 `/guard status` 確認。"
            ),
        },
    ),
)


def question_count() -> int:
    return len(QUESTIONNAIRE)


def get_question(index: int) -> QuizQuestion:
    if index < 0:
        index = 0
    if index >= len(QUESTIONNAIRE):
        index = len(QUESTIONNAIRE) - 1
    return QUESTIONNAIRE[index]


# Keep legacy names for tests that import TUTORIAL_STEPS
@dataclass(frozen=True)
class TutorialStep:
    key: str
    title: str
    body: str
    tip: str = ""


TUTORIAL_STEPS: tuple[TutorialStep, ...] = tuple(
    TutorialStep(key=q.key, title=q.title, body=q.prompt, tip="")
    for q in QUESTIONNAIRE
)


def step_count() -> int:
    return question_count()


def get_step(index: int) -> TutorialStep:
    q = get_question(index)
    return TutorialStep(key=q.key, title=q.title, body=q.prompt, tip="")
