"""Crowdsourced scam reporting."""
from __future__ import annotations

import re

import discord
from discord import app_commands

_URL_RE = re.compile(r"https?://[^\s<>\"']+", re.I)


class ReportCog(discord.ext.commands.Cog):
    def __init__(self, bot: discord.Client) -> None:
        self.bot = bot

    @app_commands.command(name="report-scam", description="回報詐騙訊息（管理員）")
    @app_commands.describe(
        message_link="詐騙訊息連結",
        scam_type="詐騙類型",
    )
    @app_commands.choices(
        scam_type=[
            app_commands.Choice(name="Fake Nitro", value="nitro"),
            app_commands.Choice(name="假驗證", value="verification"),
            app_commands.Choice(name="Crypto", value="crypto"),
            app_commands.Choice(name="被盜帳號 DM", value="hacked_dm"),
            app_commands.Choice(name="惡意下載", value="malware"),
            app_commands.Choice(name="Raid/Spam", value="raid"),
            app_commands.Choice(name="其他釣魚", value="phishing"),
        ]
    )
    async def report_scam(
        self,
        interaction: discord.Interaction,
        message_link: str,
        scam_type: app_commands.Choice[str],
    ) -> None:
        if not interaction.user.guild_permissions.manage_messages:
            await interaction.response.send_message("需要「管理訊息」權限。", ephemeral=True)
            return

        bot = self.bot
        pipeline = bot.pipeline  # type: ignore[attr-defined]

        try:
            parts = message_link.split("/")
            channel_id = int(parts[-2])
            message_id = int(parts[-1])
            channel = bot.get_channel(channel_id)
            if not isinstance(channel, discord.TextChannel):
                await interaction.response.send_message("找不到頻道。", ephemeral=True)
                return
            msg = await channel.fetch_message(message_id)
        except (ValueError, IndexError, discord.NotFound, discord.Forbidden):
            await interaction.response.send_message("無法讀取訊息連結。", ephemeral=True)
            return

        urls = _URL_RE.findall(msg.content or "")
        for url in urls:
            try:
                host = url.split("/")[2].lower()
                pipeline.urls.add_domain(host)
            except IndexError:
                pass

        embed = discord.Embed(
            title="已回報詐騙",
            description=f"類型：**{scam_type.value}**\n已將域名加入本地黑名單。",
            color=0xFEE75C,
        )
        await interaction.response.send_message(embed=embed, ephemeral=True)


async def setup(bot: discord.Client) -> None:
    await bot.add_cog(ReportCog(bot))