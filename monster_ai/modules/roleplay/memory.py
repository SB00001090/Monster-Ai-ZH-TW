"""Conversation memory with sliding window and LLM summaries."""
from __future__ import annotations

from typing import Any

from monster_ai.config import Settings
from monster_ai.core.self_repair import SelfRepairEngine
from monster_ai.llm.prompt_templates import MEMORY_SUMMARY_SYSTEM, MEMORY_SUMMARY_USER


class MemoryManager:
    def __init__(self, settings: Settings, repair: SelfRepairEngine) -> None:
        self.settings = settings
        self.repair = repair
        self.max_history = settings.modules.roleplay.max_history
        self.summary_interval = settings.modules.roleplay.memory_summary_interval

    def trim_messages(self, messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if len(messages) <= self.max_history:
            return messages
        return messages[-self.max_history :]

    def format_history(self, messages: list[dict[str, Any]]) -> str:
        lines = []
        for m in messages:
            role = m.get("role", "user")
            name = m.get("character_name") or role
            lines.append(f"{name}: {m.get('content', '')}")
        return "\n".join(lines)

    def build_context_prompt(
        self,
        base_system: str,
        memory_summary: str,
        recent_messages: list[dict[str, Any]],
    ) -> str:
        parts = [base_system]
        if memory_summary:
            parts.append(f"Story so far:\n{memory_summary}")
        history = self.format_history(recent_messages[-10:])
        if history:
            parts.append(f"Recent messages:\n{history}")
        return "\n\n".join(parts)

    async def maybe_summarize(
        self,
        messages: list[dict[str, Any]],
        memory_summary: str,
        message_count: int,
    ) -> str:
        if message_count % self.summary_interval != 0:
            return memory_summary
        history = self.format_history(messages[-self.summary_interval :])
        if not history.strip():
            return memory_summary
        summary = await self.repair.generate(
            MEMORY_SUMMARY_USER.format(history=history),
            system=MEMORY_SUMMARY_SYSTEM,
        )
        if memory_summary:
            return f"{memory_summary}\n{summary.strip()}"
        return summary.strip()