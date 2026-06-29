"""Automatic protection actions for detected scams."""
from __future__ import annotations

import logging
from datetime import timedelta

import discord

from monster_ai.modules.discord.guard.guild_config import GuildConfig
from monster_ai.modules.discord.guard.privacy import PrivacySafeLogger
from monster_ai.modules.discord.guard.threat import ThreatResult

logger = logging.getLogger(__name__)

SCAM_LABELS = {
    "nitro": "Fake Nitro / Giveaway",
    "verification": "假驗證 / 帳號安全詐騙",
    "crypto": "Crypto / 投資詐騙",
    "hacked_dm": "被盜帳號 DM 詐騙",
    "malware": "惡意下載 / 遊戲詐騙",
    "raid": "Raid / Spam 機器人",
    "phishing": "釣魚連結",
    "none": "可疑訊息",
}


class ActionEngine:
    def __init__(self, logger_store: PrivacySafeLogger) -> None:
        self.log = logger_store

    async def execute(
        self,
        message: discord.Message,
        result: ThreatResult,
        guild_cfg: GuildConfig,
    ) -> str:
        content_hash = PrivacySafeLogger.hash_content(message.content or "")
        url_hashes = [PrivacySafeLogger.hash_url(u) for u in (result.reasons or [])]

        if result.score < guild_cfg.warn_threshold:
            return "allowed"

        if result.score < guild_cfg.block_threshold:
            await self._warn_user(message, result)
            self.log.record(
                guild_id=message.guild.id,
                action="warned",
                score=result.score,
                reasons=result.reasons,
                scam_type=result.scam_type,
                content_hash=content_hash,
                url_hashes=url_hashes,
            )
            return "warned"

        try:
            await message.delete()
        except discord.Forbidden:
            logger.warning("Cannot delete message in guild %s", message.guild.id)
        except discord.NotFound:
            pass

        await self._warn_user(message, result)
        await self._notify_mods(message, result, guild_cfg)

        if guild_cfg.action_mode == "mute" and message.guild and isinstance(message.author, discord.Member):
            try:
                await message.author.timeout(
                    timedelta(minutes=10),
                    reason="MonsterGuard: suspected scam",
                )
            except discord.Forbidden:
                pass
        elif guild_cfg.action_mode == "quarantine" and message.guild and isinstance(
            message.author, discord.Member
        ):
            await self._quarantine(message.author)

        self.log.record(
            guild_id=message.guild.id,
            action="blocked",
            score=result.score,
            reasons=result.reasons,
            scam_type=result.scam_type,
            content_hash=content_hash,
            url_hashes=url_hashes,
        )
        return "blocked"

    async def _warn_user(self, message: discord.Message, result: ThreatResult) -> None:
        label = SCAM_LABELS.get(result.scam_type or "none", "可疑訊息")
        embed = discord.Embed(
            title="MonsterGuard 安全警告",
            description=(
                f"你的訊息被標記為 **{label}**（風險分數 {result.score}）。\n\n"
                "**請勿**點擊可疑連結或提供帳號密碼。\n"
                "Discord 官方不會透過 DM 要求驗證帳號或贈送 Nitro。"
            ),
            color=0xED4245,
        )
        if result.reasons:
            embed.add_field(name="偵測原因", value=", ".join(result.reasons[:5]), inline=False)
        try:
            await message.author.send(embed=embed)
        except discord.Forbidden:
            pass

    async def _notify_mods(
        self,
        message: discord.Message,
        result: ThreatResult,
        guild_cfg: GuildConfig,
    ) -> None:
        if not message.guild:
            return
        channel = None
        if guild_cfg.mod_channel_id:
            channel = message.guild.get_channel(guild_cfg.mod_channel_id)
        if not channel:
            return

        label = SCAM_LABELS.get(result.scam_type or "none", "可疑訊息")
        embed = discord.Embed(
            title=f"已攔截：{label}",
            description=f"使用者：{message.author.mention}\n頻道：<#{message.channel.id}>\n分數：**{result.score}**",
            color=0xFEE75C,
        )
        embed.add_field(name="原因", value=", ".join(result.reasons[:8]) or "—", inline=False)
        try:
            await channel.send(embed=embed)
        except discord.Forbidden:
            pass

    async def _quarantine(self, member: discord.Member) -> None:
        quarantine = discord.utils.get(member.guild.roles, name="MonsterGuard-Quarantine")
        if not quarantine:
            try:
                quarantine = await member.guild.create_role(
                    name="MonsterGuard-Quarantine",
                    reason="MonsterGuard quarantine role",
                )
            except discord.Forbidden:
                return
        try:
            await member.add_roles(quarantine, reason="MonsterGuard: suspected scam")
        except discord.Forbidden:
            pass