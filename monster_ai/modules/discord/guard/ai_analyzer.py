"""LLM intent analysis — Monster AI API, Ollama, or rule boost fallback."""
from __future__ import annotations

import json
import logging
import re

import httpx

from monster_ai.config import GuardSettings, Settings
from monster_ai.core.self_repair import SelfRepairEngine
from monster_ai.modules.discord.guard.threat import MessageContext, ThreatResult

logger = logging.getLogger(__name__)

SCAM_SYSTEM_PROMPT = """你是 Discord 反詐騙分析器。只輸出 JSON，不要其他文字：
{"is_scam":bool,"confidence":0.0-1.0,"scam_type":"nitro|verification|crypto|hacked_dm|malware|raid|phishing|none","reasons":["..."],"recommended_action":"delete|warn|monitor"}"""


class AIAnalyzer:
    def __init__(
        self,
        settings: Settings,
        repair: SelfRepairEngine | None = None,
    ) -> None:
        self.settings = settings
        self.guard = settings.modules.discord.guard
        self.repair = repair

    def _build_prompt(self, ctx: MessageContext, partial: ThreatResult) -> str:
        preview = ctx.content[:500]
        return (
            f"訊息摘要: {preview}\n"
            f"URLs: {', '.join(ctx.urls[:5]) or 'none'}\n"
            f"帳號年齡(天): {ctx.account_age_days:.1f}\n"
            f"既有規則分數: {partial.score}\n"
            f"既有原因: {', '.join(partial.reasons)}\n"
            "判斷是否為詐騙或社會工程。"
        )

    def _parse_response(self, text: str) -> ThreatResult:
        match = re.search(r"\{.*\}", text, re.S)
        if not match:
            return ThreatResult()
        try:
            data = json.loads(match.group())
        except json.JSONDecodeError:
            return ThreatResult()
        if not data.get("is_scam"):
            return ThreatResult()
        confidence = float(data.get("confidence", 0.5))
        boost = int(confidence * 40)
        return ThreatResult(
            score=boost,
            reasons=[f"ai:{r}" for r in data.get("reasons", ["llm_detected"])],
            scam_type=data.get("scam_type", "phishing"),
            confidence=confidence,
            recommended_action=data.get("recommended_action", "delete"),
        )

    async def analyze(self, ctx: MessageContext, partial: ThreatResult) -> ThreatResult:
        if not ctx.extra.get("ai_enabled", True):
            return ThreatResult()

        backend = self.guard.ai_backend
        if backend == "auto":
            if self.guard.monster_ai_url or self.guard.mode == "embedded":
                backend = "local_monster_ai"
            elif self.repair and self.repair.state.primary_ok:
                backend = "ollama"
            else:
                backend = "none"

        prompt = self._build_prompt(ctx, partial)

        try:
            if backend == "local_monster_ai":
                return await self._call_monster_api(prompt)
            if backend == "ollama" and self.repair:
                raw = await self.repair.generate(prompt, system=SCAM_SYSTEM_PROMPT)
                return self._parse_response(raw)
        except Exception as exc:  # noqa: BLE001
            logger.warning("AI analyzer failed: %s", exc)

        return self._rule_boost(partial)

    async def _call_monster_api(self, prompt: str) -> ThreatResult:
        base = self.guard.monster_ai_url or f"http://{self.settings.host}:{self.settings.port}"
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{base.rstrip('/')}/api/guard/analyze",
                json={"prompt": prompt, "system": SCAM_SYSTEM_PROMPT},
            )
            resp.raise_for_status()
            data = resp.json()
        if not data.get("is_scam"):
            return ThreatResult()
        return ThreatResult(
            score=int(data.get("score", 30)),
            reasons=data.get("reasons", ["ai:api"]),
            scam_type=data.get("scam_type", "phishing"),
            confidence=float(data.get("confidence", 0.7)),
            recommended_action=data.get("recommended_action", "delete"),
        )

    def _rule_boost(self, partial: ThreatResult) -> ThreatResult:
        if partial.score >= 55:
            return ThreatResult(
                score=15,
                reasons=["ai:fallback_boost"],
                scam_type=partial.scam_type or "phishing",
                confidence=0.5,
                recommended_action="warn",
            )
        return ThreatResult()