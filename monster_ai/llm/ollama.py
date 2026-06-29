"""Primary LLM via local Ollama (CUDA handled by Ollama)."""
from __future__ import annotations

import httpx

from monster_ai.config import Settings
from monster_ai.llm.base import LLMProvider


class OllamaLLM(LLMProvider):
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.base = settings.llm.ollama_url.rstrip("/")
        self.model = settings.llm.model
        self.timeout = settings.llm.timeout_seconds

    def _model_available(self, names: list[str]) -> bool:
        """Match Ollama tag names (e.g. llama3.2:3b or llama3.2:latest)."""
        target = self.model
        if target in names:
            return True
        base, _, tag = target.partition(":")
        for name in names:
            n_base, _, n_tag = name.partition(":")
            if n_base == base and (not tag or tag == n_tag or n_tag == "latest"):
                return True
        return False

    async def ping(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.get(f"{self.base}/api/tags")
                if response.status_code != 200:
                    return False
                names = [m.get("name", "") for m in response.json().get("models", [])]
                return self._model_available(names)
        except httpx.HTTPError:
            return False

    async def generate(self, prompt: str, system: str | None = None) -> str:
        payload: dict = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "num_ctx": self.settings.llm.num_ctx,
                "temperature": self.settings.llm.temperature,
            },
        }
        if system:
            payload["system"] = system

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(f"{self.base}/api/generate", json=payload)
            if response.status_code == 404:
                raise RuntimeError(
                    f"Ollama model '{self.model}' not found. "
                    f"Run: ollama pull {self.model}"
                )
            response.raise_for_status()
            data = response.json()
            return data.get("response", "")