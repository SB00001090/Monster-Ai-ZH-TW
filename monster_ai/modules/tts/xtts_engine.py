"""Optional Coqui XTTS voice cloning (heavy — off by default on 8GB VRAM)."""
from __future__ import annotations

import uuid
from pathlib import Path


class XTTSEngine:
    def __init__(self, output_dir: Path, voices_dir: Path) -> None:
        self.output_dir = output_dir
        self.voices_dir = voices_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def _reference(self, reference_id: str) -> Path:
        ref = self.voices_dir / reference_id
        if ref.exists():
            return ref
        for p in self.voices_dir.glob("*.wav"):
            if reference_id in p.stem:
                return p
        raise FileNotFoundError(f"Voice reference not found: {reference_id}")

    async def clone(self, text: str, reference_id: str) -> Path:
        try:
            from TTS.api import TTS  # type: ignore[import-untyped]
        except ImportError as exc:
            raise RuntimeError(
                "XTTS not installed. pip install TTS (optional, heavy VRAM)."
            ) from exc

        ref = self._reference(reference_id)
        out = self.output_dir / f"{uuid.uuid4().hex}.wav"
        tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2")
        tts.tts_to_file(text=text, speaker_wav=str(ref), language="en", file_path=str(out))
        return out