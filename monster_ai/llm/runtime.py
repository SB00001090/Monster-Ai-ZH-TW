"""Tier-aware inference runtime: Ollama → llama.cpp GGUF → rules fallback."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

from monster_ai.config import Settings
from monster_ai.core.hardware_probe import HardwareProbeResult
from monster_ai.llm.base import LLMProvider
from monster_ai.llm.fallback import FallbackLLM
from monster_ai.llm.ollama import OllamaLLM

logger = logging.getLogger(__name__)


@dataclass
class RuntimeState:
    active_backend: str = "none"
    tier: str = "cpu_only"
    model: str = ""
    primary_ok: bool = False
    last_error: str | None = None


class LlamaCppLLM(LLMProvider):
    def __init__(self, gguf_path: Path, *, n_ctx: int = 2048, n_threads: int = 0) -> None:
        self.gguf_path = gguf_path
        self.n_ctx = n_ctx
        self.n_threads = n_threads or max(1, __import__("os").cpu_count() or 1)
        self._llm: Any = None

    def _ensure_loaded(self) -> bool:
        if self._llm is not None:
            return True
        if not self.gguf_path.exists():
            return False
        try:
            from llama_cpp import Llama  # type: ignore[import-untyped]

            self._llm = Llama(
                model_path=str(self.gguf_path),
                n_ctx=self.n_ctx,
                n_threads=self.n_threads,
                verbose=False,
            )
            return True
        except Exception as exc:  # noqa: BLE001
            logger.debug("llama.cpp load failed: %s", exc)
            return False

    async def ping(self) -> bool:
        return self._ensure_loaded()

    async def generate(self, prompt: str, system: str | None = None) -> str:
        if not self._ensure_loaded():
            raise RuntimeError(f"GGUF not available: {self.gguf_path}")
        full = f"{system}\n\n{prompt}" if system else prompt
        out = self._llm(full, max_tokens=512, temperature=0.3)
        return out["choices"][0]["text"].strip()


def load_inference_presets(root: Path) -> dict[str, Any]:
    path = root / "data" / "models" / "inference_presets.yaml"
    if path.exists():
        return yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return {}


class InferenceRuntime:
    def __init__(self, settings: Settings, probe: HardwareProbeResult, root: Path) -> None:
        self.settings = settings
        self.probe = probe
        self.root = root
        self.state = RuntimeState(tier=probe.tier)
        self.presets = load_inference_presets(root)
        self._apply_tier_preset()
        self.ollama = OllamaLLM(settings)
        self.fallback = FallbackLLM()
        self._llama_cpp: LlamaCppLLM | None = None
        gguf_cfg = self.presets.get("gguf_fallback", {})
        gguf_path = root / str(gguf_cfg.get("path", "")).lstrip("./")
        if "llama_cpp" in probe.backends:
            self._llama_cpp = LlamaCppLLM(
                gguf_path,
                n_ctx=int(gguf_cfg.get("n_ctx", 2048)),
                n_threads=int(gguf_cfg.get("n_threads", 0)),
            )

    def _apply_tier_preset(self) -> None:
        tier_cfg = (self.presets.get("tiers") or {}).get(self.probe.tier, {})
        if tier_cfg.get("model") and tier_cfg["model"] != "none":
            self.settings.llm.model = str(tier_cfg["model"])
        if tier_cfg.get("num_ctx"):
            self.settings.llm.num_ctx = int(tier_cfg["num_ctx"])
        self.state.model = self.settings.llm.model

    @property
    def llm_analysis_enabled(self) -> bool:
        tier_cfg = (self.presets.get("tiers") or {}).get(self.probe.tier, {})
        return bool(tier_cfg.get("llm_analysis", True))

    async def heal(self) -> None:
        if await self.ollama.ping():
            self.state.primary_ok = True
            self.state.active_backend = "ollama"
            self.state.last_error = None
            return
        if self._llama_cpp and await self._llama_cpp.ping():
            self.state.primary_ok = True
            self.state.active_backend = "llama_cpp"
            self.state.last_error = None
            return
        self.state.primary_ok = False
        self.state.active_backend = "rules"
        self.state.last_error = "No LLM backend available"

    async def generate(self, prompt: str, system: str | None = None) -> str:
        if self.state.primary_ok and self.state.active_backend == "ollama":
            try:
                return await self.ollama.generate(prompt, system=system)
            except Exception as exc:  # noqa: BLE001
                self.state.last_error = str(exc)
                self.state.primary_ok = False
        if self._llama_cpp:
            try:
                if await self._llama_cpp.ping():
                    self.state.active_backend = "llama_cpp"
                    return await self._llama_cpp.generate(prompt, system=system)
            except Exception as exc:  # noqa: BLE001
                self.state.last_error = str(exc)
        self.state.active_backend = "rules"
        return await self.fallback.generate(prompt, system=system)

    def to_dict(self) -> dict[str, Any]:
        return {
            "active_backend": self.state.active_backend,
            "tier": self.state.tier,
            "model": self.state.model,
            "primary_ok": self.state.primary_ok,
            "last_error": self.state.last_error,
            "probe": self.probe.to_dict(),
            "llm_analysis_enabled": self.llm_analysis_enabled,
        }