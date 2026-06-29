"""MonsterGuard detection pipeline — rules → AI → action decision."""
from __future__ import annotations

from pathlib import Path

from monster_ai.config import Settings
from monster_ai.core.self_repair import SelfRepairEngine
from monster_ai.modules.discord.guard.ai_analyzer import AIAnalyzer
from monster_ai.modules.discord.guard.behavior import BehaviorTracker
from monster_ai.modules.discord.guard.guild_config import GuildConfig
from monster_ai.modules.discord.guard.scorer import RuleScorer
from monster_ai.modules.discord.guard.threat import MessageContext, ThreatResult
from monster_ai.modules.discord.guard.url_scanner import UrlScanner


class DetectionPipeline:
    def __init__(
        self,
        settings: Settings,
        repair: SelfRepairEngine | None = None,
        data_dir: Path | None = None,
    ) -> None:
        package_data = Path(__file__).resolve().parent / "data"
        base = data_dir or Path(settings.modules.discord.guard.data_dir)
        if not (base / "rules" / "v2026.06.yaml").exists():
            base = package_data
        rules = base / "rules" / "v2026.06.yaml"
        blacklist = base / "blacklists" / "domains.txt"
        self.rules = RuleScorer(rules)
        self.urls = UrlScanner(blacklist)
        self.behavior = BehaviorTracker()
        self.ai = AIAnalyzer(settings, repair)
        self._rules_version = "v2026.06"

    @property
    def rules_version(self) -> str:
        return self._rules_version

    def build_context(
        self,
        *,
        content: str,
        author_id: int,
        author_name: str,
        account_created_at,
        guild_id: int,
        channel_id: int,
        message_id: int,
        attachment_names: list[str],
        mention_everyone: bool,
        guild_cfg: GuildConfig,
        is_bot: bool = False,
    ) -> MessageContext:
        urls = self.rules.extract_urls(content)
        return MessageContext(
            content=content,
            urls=urls,
            author_id=author_id,
            author_name=author_name,
            account_created_at=account_created_at,
            guild_id=guild_id,
            channel_id=channel_id,
            message_id=message_id,
            attachment_names=attachment_names,
            mention_everyone=mention_everyone,
            block_threshold=guild_cfg.block_threshold,
            warn_threshold=guild_cfg.warn_threshold,
            ai_threshold=guild_cfg.ai_threshold,
            is_bot=is_bot,
            extra={"ai_enabled": guild_cfg.ai_enabled},
        )

    async def analyze(self, ctx: MessageContext) -> ThreatResult:
        result = ThreatResult()

        result.merge(self.rules.score(ctx))
        result.merge(await self.urls.scan(ctx.urls))
        result.merge(self.behavior.score(ctx))

        if result.score >= ctx.block_threshold:
            result.recommended_action = "delete"
            return result

        if result.score < ctx.ai_threshold:
            return result

        ai_result = await self.ai.analyze(ctx, result)
        result.merge(ai_result)

        if result.score >= ctx.block_threshold:
            result.recommended_action = "delete"
        elif result.score >= ctx.warn_threshold:
            result.recommended_action = "warn"

        return result