"""Monster AI Chat Bridge — /chat slash command."""
from __future__ import annotations

import time
from collections import defaultdict, deque

import discord
from discord import app_commands


class ChatBridgeCog(discord.ext.commands.Cog):
    def __init__(self, bot: discord.Client) -> None:
        self.bot = bot
        self._rate: dict[int, deque[float]] = defaultdict(deque)

    def _allow(self, user_id: int, limit: int) -> bool:
        now = time.monotonic()
        q = self._rate[user_id]
        q.append(now)
        while q and now - q[0] > 60:
            q.popleft()
        return len(q) <= limit

    @app_commands.command(name="chat", description="與 Monster AI 對話（使用本地 LLM）")
    @app_commands.describe(message="你的訊息", persona="Persona 模式：grok / off")
    async def chat(
        self,
        interaction: discord.Interaction,
        message: str,
        persona: str = "grok",
    ) -> None:
        bot = self.bot
        guard = bot.guard_settings  # type: ignore[attr-defined]
        chat_svc = bot.chat  # type: ignore[attr-defined]

        if not guard.chat_bridge_enabled:
            await interaction.response.send_message("Chat Bridge 未啟用。", ephemeral=True)
            return
        if chat_svc is None:
            await interaction.response.send_message(
                "Monster AI Chat 服務未連接。請以 embedded 模式啟動 Monster AI。",
                ephemeral=True,
            )
            return
        if not self._allow(interaction.user.id, guard.chat_rate_limit_per_minute):
            await interaction.response.send_message("請稍後再試（速率限制）。", ephemeral=True)
            return

        await interaction.response.defer(thinking=True)
        try:
            result = await chat_svc.send(message, persona_mode=persona)
            content = result.get("content", "")
            backend = result.get("backend", "unknown")
            if len(content) > 1900:
                content = content[:1900] + "…"
            embed = discord.Embed(description=content, color=0x6EE7B7)
            embed.set_footer(text=f"Monster AI · backend: {backend}")
            await interaction.followup.send(embed=embed)
        except Exception as exc:  # noqa: BLE001
            await interaction.followup.send(f"Chat 失敗: {exc}", ephemeral=True)

    @app_commands.command(name="roleplay", description="Monster AI 角色扮演對話")
    @app_commands.describe(message="你的訊息", session_id="Roleplay session ID")
    async def roleplay(
        self,
        interaction: discord.Interaction,
        message: str,
        session_id: str | None = None,
    ) -> None:
        bot = self.bot
        roleplay_svc = bot.roleplay  # type: ignore[attr-defined]
        settings = bot.monster_settings  # type: ignore[attr-defined]

        if roleplay_svc is None or not settings.modules.roleplay.enabled:
            await interaction.response.send_message("Roleplay 模組未啟用。", ephemeral=True)
            return
        if not session_id:
            await interaction.response.send_message(
                "請提供 session_id（先於 Web UI 建立 roleplay session）。",
                ephemeral=True,
            )
            return

        await interaction.response.defer(thinking=True)
        try:
            result = await roleplay_svc.send_message(session_id, message)
            content = result.get("content", result.get("message", ""))
            if len(str(content)) > 1900:
                content = str(content)[:1900] + "…"
            embed = discord.Embed(description=str(content), color=0xA78BFA)
            embed.set_footer(text="Monster AI Roleplay")
            await interaction.followup.send(embed=embed)
        except Exception as exc:  # noqa: BLE001
            await interaction.followup.send(f"Roleplay 失敗: {exc}", ephemeral=True)


async def setup(bot: discord.Client) -> None:
    await bot.add_cog(ChatBridgeCog(bot))