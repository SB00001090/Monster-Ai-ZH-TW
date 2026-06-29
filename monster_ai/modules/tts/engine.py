"""TTS facade — Piper default, optional XTTS clone."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from monster_ai.config import Settings
from monster_ai.core.generation_history import GenerationHistory
from monster_ai.core.generation_repair import GenerationRepair, validate_audio_file
from monster_ai.core.vram_guard import VramGuard
from monster_ai.modules.tts.piper_engine import PiperEngine
from monster_ai.modules.tts.xtts_engine import XTTSEngine


class TTSService:
    name = "tts"

    def __init__(
        self,
        settings: Settings,
        gen_repair: GenerationRepair,
        vram_guard: VramGuard,
        history: GenerationHistory | None = None,
    ) -> None:
        self.settings = settings
        self.gen_repair = gen_repair
        self.vram_guard = vram_guard
        self.history = history
        cfg = settings.modules.tts
        self.piper = PiperEngine(
            voice=cfg.piper_voice,
            models_dir=Path("./data/models/piper"),
            output_dir=Path(cfg.output_dir),
        )
        self.xtts = XTTSEngine(
            output_dir=Path(cfg.output_dir),
            voices_dir=Path("./data/voices"),
        ) if cfg.xtts_enabled else None

    async def health(self) -> dict[str, Any]:
        if not self.settings.modules.tts.enabled:
            return {"enabled": False, "healthy": False, "message": "Module disabled"}
        model_ok = self.piper._model_path() is not None
        return {
            "enabled": True,
            "healthy": model_ok,
            "engine": self.settings.modules.tts.engine,
            "xtts": bool(self.xtts),
            "message": "Piper ready" if model_ok else "Run install_modules.py for Piper voices",
        }

    async def synthesize(self, text: str) -> dict[str, Any]:
        if not self.settings.modules.tts.enabled:
            raise RuntimeError("TTS module disabled")

        async def _run() -> Path:
            async with self.vram_guard.acquire("tts"):
                return await self.piper.synthesize(text)

        path = await self.gen_repair.run("tts", _run, validate=lambda p: validate_audio_file(p))
        result = {"path": str(path), "url": f"/api/generate/files/audio/{path.name}", "prompt": text}
        if self.history:
            self.history.record("tts", result)
        return result

    async def clone(self, text: str, reference_id: str) -> dict[str, Any]:
        if not self.xtts:
            raise RuntimeError("XTTS disabled in config (modules.tts.xtts_enabled)")

        async def _run() -> Path:
            async with self.vram_guard.acquire("xtts"):
                return await self.xtts.clone(text, reference_id)

        path = await self.gen_repair.run("xtts", _run, validate=lambda p: validate_audio_file(p))
        return {"path": str(path), "url": f"/api/generate/files/audio/{path.name}"}