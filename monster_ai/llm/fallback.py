"""Always-available fallback when Ollama/GPU fails."""
from __future__ import annotations

import re

from monster_ai.llm.base import LLMProvider


class FallbackLLM(LLMProvider):
    """Rule-based fallback. Never requires GPU or network."""

    async def ping(self) -> bool:
        return True

    async def generate(self, prompt: str, system: str | None = None) -> str:
        text = prompt.strip()
        if not text:
            return "[Monster AI] I'm running in fallback mode. Send a message to continue."

        lower = text.lower()
        if lower in {"hi", "hello", "hey", "help"}:
            return (
                "[Fallback mode] Primary model is offline. "
                "Start Ollama (`ollama serve`) and pull a model "
                "(`ollama pull llama3.2:3b`), then restart Monster AI."
            )

        if re.search(r"\*[^*]+\*", text):
            return (
                "[Fallback mode] The scene pauses — full roleplay needs the main LLM. "
                "See README → Troubleshooting."
            )

        return (
            f"[Fallback mode] I received your message ({len(text)} chars) but cannot "
            "run the full model right now. Fix: `ollama serve` + `ollama pull llama3.2:3b`."
        )