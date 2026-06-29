"""Piper TTS — lightweight local speech synthesis."""
from __future__ import annotations

import asyncio
import subprocess
import uuid
from pathlib import Path


class PiperEngine:
    def __init__(self, voice: str, models_dir: Path, output_dir: Path) -> None:
        self.voice = voice
        self.models_dir = models_dir
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def _model_path(self) -> Path | None:
        onnx = self.models_dir / f"{self.voice}.onnx"
        if onnx.exists():
            return onnx
        for p in self.models_dir.glob("*.onnx"):
            if self.voice in p.stem:
                return p
        return None

    async def synthesize(self, text: str) -> Path:
        model = self._model_path()
        out = self.output_dir / f"{uuid.uuid4().hex}.wav"

        if model:
            try:
                from piper import PiperVoice  # type: ignore[import-untyped]

                voice = PiperVoice.load(str(model))
                with out.open("wb") as f:
                    voice.synthesize(text, f)
                return out
            except ImportError:
                pass

            proc = await asyncio.create_subprocess_exec(
                "piper", "--model", str(model), "--output_file", str(out),
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await proc.communicate(input=text.encode("utf-8"))
            if out.exists():
                return out

        raise RuntimeError(
            f"Piper model not found for '{self.voice}'. "
            "Run scripts/install_modules.py to download voice models."
        )