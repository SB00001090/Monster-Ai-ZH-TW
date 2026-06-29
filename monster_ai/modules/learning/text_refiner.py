"""LLM reflect step for failed text validation (Phase B)."""
from __future__ import annotations

from typing import Any

from monster_ai.core.self_repair import SelfRepairEngine

REFLECT_SYSTEM = """You improve assistant replies that failed quality checks.
Output ONLY the improved assistant message. No preamble. Stay in character."""


class TextRefiner:
    def __init__(self, repair: SelfRepairEngine) -> None:
        self.repair = repair

    async def reflect(
        self,
        *,
        user_message: str,
        failed_output: str,
        report: dict[str, Any],
        system: str,
    ) -> str:
        reasons = ", ".join(report.get("reasons", [])) or "quality_low"
        prompt = (
            f"User message:\n{user_message}\n\n"
            f"Failed reply:\n{failed_output}\n\n"
            f"Quality issues: {reasons}\n"
            f"Score: {report.get('score', 0)}\n\n"
            "Rewrite a better reply."
        )
        return await self.repair.generate(prompt, system=f"{system}\n\n{REFLECT_SYSTEM}")