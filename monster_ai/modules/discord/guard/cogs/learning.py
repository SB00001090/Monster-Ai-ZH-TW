"""Discord learning feedback — autonomous evolution loop."""
from __future__ import annotations

import logging

import discord
from discord import app_commands
from discord.ext import commands

from monster_ai.modules.discord.guard.interaction_utils import safe_defer, safe_followup
from monster_ai.modules.discord.guard.ui.embeds import neon_footer

logger = logging.getLogger(__name__)


class LearningCog(commands.Cog):
    def __init__(self, bot: discord.Client) -> None:
        self.bot = bot

    def _learning(self):
        chat = getattr(self.bot, "chat", None)
        return getattr(chat, "learning", None) if chat else None

    @app_commands.command(name="feedback", description="回饋 Monster AI 回覆，驅動自主學習")
    @app_commands.describe(
        thumbs="up 或 down",
        comment="補充說明（例如：太長、要更詳細）",
        last_message="你上一則問題（down 時用於自動改進重答）",
    )
    async def feedback_cmd(
        self,
        interaction: discord.Interaction,
        thumbs: str,
        comment: str = "",
        last_message: str = "",
    ) -> None:
        if not await safe_defer(interaction):
            return
        engine = self._learning()
        if engine is None or not engine.settings.enabled:
            await safe_followup(interaction, "學習模組未啟用。")
            return
        norm = thumbs.strip().lower()
        if norm not in {"up", "down"}:
            await safe_followup(interaction, "thumbs 請填 up 或 down。")
            return

        user_id = f"discord:{interaction.user.id}"
        try:
            if norm == "down" and last_message.strip():
                result = await engine.record_feedback_and_regenerate(
                    user_id=user_id,
                    session_id=f"discord:{interaction.channel_id}",
                    thumbs=norm,
                    comment=comment,
                    message=last_message,
                    last_user_message=last_message,
                )
                regen = result.get("regenerated")
                if regen:
                    content = str(regen.get("content", ""))[:1900]
                    embed = discord.Embed(
                        title="已學習並改進回覆",
                        description=content,
                        color=0x39FF14,
                    )
                    embed.set_footer(text=neon_footer() + " · 自主學習")
                    await safe_followup(interaction, embed=embed)
                    return
            result = engine.record_feedback(
                user_id=user_id,
                session_id=f"discord:{interaction.channel_id}",
                thumbs=norm,
                comment=comment,
                message=last_message,
            )
            await safe_followup(
                interaction,
                "已記錄回饋，Monster AI 會在後續對話中持續進化。" if result.get("ok") else "回饋失敗。",
            )
        except Exception as exc:  # noqa: BLE001
            await safe_followup(interaction, f"回饋失敗: {exc}")

    @app_commands.command(name="learn", description="連接網絡學習知識並存入 Monster AI 知識庫")
    @app_commands.describe(query="要學習的主題或問題", refresh="強制重新搜尋（忽略快取）")
    async def learn_cmd(
        self,
        interaction: discord.Interaction,
        query: str,
        refresh: bool = False,
    ) -> None:
        if not await safe_defer(interaction, thinking=True):
            return
        engine = self._learning()
        if engine is None or not engine.settings.web_learning_enabled:
            await safe_followup(interaction, "網絡學習未啟用。")
            return
        try:
            result = await engine.learn_from_web(query, force_refresh=refresh)
            if not result.get("ok"):
                await safe_followup(interaction, f"學習失敗：{result.get('reason', 'unknown')}")
                return
            summary = str(result.get("summary", "")).strip()
            desc = (
                f"**主題：** {query}\n"
                f"**新增事實：** {result.get('facts_added', 0)}\n"
                f"**知識庫總量：** {result.get('fact_count', 0)}\n"
                f"**快取：** {'是' if result.get('cached') else '否'}"
            )
            if summary:
                desc += f"\n\n{summary[:1500]}"
            embed = discord.Embed(title="網絡知識已學習", description=desc, color=0x00F5FF)
            embed.set_footer(text=neon_footer() + " · 網絡學習")
            await safe_followup(interaction, embed=embed)
        except Exception as exc:  # noqa: BLE001
            await safe_followup(interaction, f"學習失敗: {exc}")

    @app_commands.command(name="ailearn", description="啟動網絡自主學習（AI / 語言 / 資安）")
    @app_commands.describe(
        hours="學習時長（extended 預設 72）",
        resume="從上次進度繼續",
        extended="AI + 全部語言 + 資安反制",
    )
    async def ailearn_cmd(
        self,
        interaction: discord.Interaction,
        hours: float | None = None,
        resume: bool = True,
        extended: bool = False,
    ) -> None:
        # MUST be first — event loop may be busy with Ollama/curriculum
        if not await safe_defer(interaction, thinking=True):
            return

        engine = self._learning()
        if engine is None or not engine.settings.curriculum_enabled:
            await safe_followup(
                interaction,
                "36h 課程未啟用。請在 `config.yaml` 設 `learning.curriculum_enabled: true` 並重啟。",
            )
            return

        try:
            # Already running? Report progress instead of hanging
            try:
                cur = engine.curriculum_status()
            except Exception:  # noqa: BLE001
                cur = {}
            if cur.get("running"):
                embed = discord.Embed(
                    title="🧠 自主學習已在進行中",
                    description=(
                        f"**模式：** `{cur.get('mode') or 'base'}`\n"
                        f"**進度：** {cur.get('progress_pct', 0)}% "
                        f"({cur.get('completed_topics', 0)}/{cur.get('total_topics', 0)})\n"
                        f"**階段：** `{cur.get('current_phase') or '—'}`\n"
                        f"**主題：** `{cur.get('current_topic_id') or '—'}`\n"
                        f"**訓練對：** {cur.get('pairs_on_disk', 0)}\n"
                        f"**剩餘約：** {cur.get('eta_hours', '—')}h\n\n"
                        "查看進度：`/aistatus`\n"
                        "無需重複啟動；若要改模式請先等本輪結束或重啟服務。"
                    ),
                    color=0x00F5FF,
                )
                embed.set_footer(text=neon_footer() + " · 課程進行中")
                await safe_followup(interaction, embed=embed)
                return

            mode = "extended" if extended else "base"
            result = await engine.start_curriculum(
                duration_hours=hours,
                resume=resume,
                mode=mode,
            )
            if not result.get("ok"):
                reason = result.get("reason", "unknown")
                if reason == "already_running":
                    st = result.get("status") or engine.curriculum_status()
                    await safe_followup(
                        interaction,
                        f"課程已在運行中（進度 {st.get('progress_pct', 0)}%）。用 `/aistatus` 查看。",
                    )
                    return
                await safe_followup(interaction, f"啟動失敗：`{reason}`")
                return

            st = result.get("status") or {}
            label = "完整（AI+語言+資安）" if extended else "AI 36h"
            embed = discord.Embed(
                title="🚀 已啟動網絡自主學習",
                description=(
                    f"**時長：** **{st.get('duration_hours', hours or 36)}h** · {label}\n"
                    f"**主題數：** {st.get('total_topics', 72)}\n"
                    f"**目前進度：** {st.get('completed_topics', 0)}\n"
                    f"**模式：** `{mode}` · resume=`{resume}`\n\n"
                    f"訓練輸出：`data/training/curriculum/monster_ai_train.jsonl`\n"
                    f"進度查詢：`/aistatus`"
                ),
                color=0x39FF14,
            )
            embed.set_footer(text=neon_footer() + " · /ailearn")
            await safe_followup(interaction, embed=embed)
        except Exception as exc:  # noqa: BLE001
            logger.exception("ailearn failed: %s", exc)
            await safe_followup(interaction, f"啟動失敗: {exc}")

    @app_commands.command(name="aistatus", description="查看 36h AI 學習進度")
    async def aistatus_cmd(self, interaction: discord.Interaction) -> None:
        if not await safe_defer(interaction):
            return
        engine = self._learning()
        if engine is None:
            await safe_followup(interaction, "學習模組未連接。")
            return
        try:
            st = engine.curriculum_status()
            embed = discord.Embed(
                title="Monster AI 學習進度",
                description=(
                    f"**狀態：** {'進行中' if st.get('running') else '已停止'}\n"
                    f"**進度：** {st.get('progress_pct', 0)}% "
                    f"({st.get('completed_topics', 0)}/{st.get('total_topics', 0)})\n"
                    f"**訓練對：** {st.get('pairs_on_disk', 0)}\n"
                    f"**階段：** {st.get('current_phase') or '—'}\n"
                    f"**主題：** {st.get('current_topic_id') or '—'}\n"
                    f"**模式：** `{st.get('mode') or '—'}`\n"
                    f"**已用：** {st.get('elapsed_hours', 0)}h · "
                    f"**剩餘：** {st.get('eta_hours', 0)}h"
                ),
                color=0x00F5FF,
            )
            embed.set_footer(text=neon_footer())
            await safe_followup(interaction, embed=embed)
        except Exception as exc:  # noqa: BLE001
            await safe_followup(interaction, f"讀取進度失敗: {exc}")

    @app_commands.command(name="rolelearn", description="角色扮演：連接網絡學習世界觀並寫入角色知識庫")
    @app_commands.describe(
        query="要學習的世界觀/設定主題",
        character_id="角色 ID（可留空，使用最新 roleplay session 角色）",
        refresh="強制重新搜尋",
    )
    async def rolelearn_cmd(
        self,
        interaction: discord.Interaction,
        query: str,
        character_id: str | None = None,
        refresh: bool = False,
    ) -> None:
        if not await safe_defer(interaction, thinking=True):
            return
        roleplay_svc = getattr(self.bot, "roleplay", None)
        if roleplay_svc is None:
            await safe_followup(interaction, "Roleplay 未連接。")
            return
        try:
            sessions = roleplay_svc.list_sessions()
            session_id = str(sessions[0]["id"]) if sessions else None
            result = await roleplay_svc.learn_lore(
                query,
                character_id=character_id,
                session_id=session_id,
                force_refresh=refresh,
            )
            if not result.get("ok"):
                await safe_followup(interaction, f"學習失敗：{result.get('reason', 'unknown')}")
                return
            facts = result.get("lore_facts") or []
            desc = (
                f"**主題：** {query}\n"
                f"**寫入角色庫：** {result.get('kb_facts_added', 0)} 條\n"
                f"**角色：** {result.get('character_id') or '（未綁定）'}"
            )
            if facts:
                desc += "\n\n" + "\n".join(f"• {f[:200]}" for f in facts[:4])
            embed = discord.Embed(title="角色世界觀已學習", description=desc[:1900], color=0xA78BFA)
            embed.set_footer(text=neon_footer() + " · 角色網絡學習")
            await safe_followup(interaction, embed=embed)
        except Exception as exc:  # noqa: BLE001
            await safe_followup(interaction, f"學習失敗: {exc}")

    @app_commands.command(name="imagelearn", description="從歷史出圖品質學習完美圖片生成技巧")
    async def imagelearn_cmd(self, interaction: discord.Interaction) -> None:
        if not await safe_defer(interaction, thinking=True):
            return
        engine = self._learning()
        if engine is None or not engine.image or not engine.image.enabled:
            await safe_followup(interaction, "圖像學習未啟用。")
            return
        try:
            result = await engine.learn_perfect_images()
            if not result.get("ok"):
                await safe_followup(interaction, f"圖像學習失敗：{result.get('reason', 'unknown')}")
                return
            tags = ", ".join(result.get("learned_tags") or []) or "（預設品質標籤）"
            embed = discord.Embed(
                title="完美圖片學習完成",
                description=(
                    f"**優秀樣本：** {result.get('good_count', 0)}\n"
                    f"**失敗樣本：** {result.get('bad_count', 0)}\n"
                    f"**學到標籤：** {tags}\n"
                    f"**訓練樣本：** {result.get('training_samples', 0)}\n"
                    f"**可訓練 LoRA：** {'是' if result.get('training_ready') else '否'}"
                ),
                color=0xFF00FF,
            )
            embed.set_footer(text=neon_footer() + " · 圖像學習")
            await safe_followup(interaction, embed=embed)
        except Exception as exc:  # noqa: BLE001
            await safe_followup(interaction, f"圖像學習失敗: {exc}")

    @app_commands.command(name="evolve", description="查看 Monster AI 自主學習與進化狀態")
    async def evolve_cmd(self, interaction: discord.Interaction) -> None:
        if not await safe_defer(interaction):
            return
        engine = self._learning()
        if engine is None:
            await safe_followup(interaction, "學習模組未連接。")
            return
        try:
            snap = engine.evolution_snapshot()
            failures = snap.get("quality_failures", {})
            top = failures.get("top_reasons") or []
            reasons = ", ".join(f"{r['reason']}({r['count']})" for r in top[:3]) or "無"
            embed = discord.Embed(
                title="Monster AI 進化狀態",
                description=(
                    f"**回饋事件：** {snap.get('feedback_events', 0)}\n"
                    f"**品質失敗：** {failures.get('failure_count', 0)}\n"
                    f"**常見失敗原因：** {reasons}\n"
                    f"**品質門檻：** {snap.get('min_quality_score')} "
                    f"(設定 {snap.get('configured_min_quality')})\n"
                    f"**Reflect：** {'開' if snap.get('reflect_enabled') else '關'}\n"
                    f"**上下文注入：** {'開' if snap.get('inject_context_always') else '關'}\n"
                    f"**網絡知識：** {snap.get('web', {}).get('total_facts', 0)} 條 "
                    f"({snap.get('web', {}).get('topics_learned', 0)} 主題)\n"
                    f"**圖像學習：** 優 {snap.get('image', {}).get('good_count', 0)} / "
                    f"劣 {snap.get('image', {}).get('bad_count', 0)} · "
                    f"訓練樣本 {snap.get('image', {}).get('training_samples', 0)}"
                ),
                color=0x9D4EDD,
            )
            embed.set_footer(text=neon_footer())
            await safe_followup(interaction, embed=embed)
        except Exception as exc:  # noqa: BLE001
            await safe_followup(interaction, f"讀取失敗: {exc}")


async def setup(bot: discord.Client) -> None:
    await bot.add_cog(LearningCog(bot))
