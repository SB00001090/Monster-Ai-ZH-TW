"""Abstract LLM provider interface."""
from __future__ import annotations

from abc import ABC, abstractmethod


class LLMProvider(ABC):
    @abstractmethod
    async def ping(self) -> bool:
        """Return True if the backend is reachable."""

    @abstractmethod
    async def generate(self, prompt: str, system: str | None = None) -> str:
        """Generate a text response."""