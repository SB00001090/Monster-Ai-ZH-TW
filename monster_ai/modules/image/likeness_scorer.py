"""Face likeness scoring — optional InsightFace with numpy fallback."""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

from monster_ai.modules.guardian.image_fingerprint import compute_phash, phash_similarity

logger = logging.getLogger(__name__)

DEFAULT_TARGET = 0.85
INSIGHTFACE_TARGET = 0.98


def _center_crop(img: Image.Image, fraction: float = 0.62) -> Image.Image:
    w, h = img.size
    cw = max(32, int(w * fraction))
    ch = max(32, int(h * fraction))
    left = (w - cw) // 2
    top = (h - ch) // 2
    return img.crop((left, top, left + cw, top + ch))


def _rgb_vector(path: Path, size: int = 96) -> np.ndarray:
    with Image.open(path) as img:
        crop = _center_crop(img.convert("RGB"))
        small = crop.resize((size, size), Image.Resampling.BILINEAR)
        arr = np.asarray(small, dtype=np.float32).reshape(-1)
    norm = float(np.linalg.norm(arr))
    return arr / norm if norm > 0 else arr


class FaceLikenessScorer:
    """Compare generated output against a reference portrait."""

    def __init__(self, *, target_similarity: float = DEFAULT_TARGET) -> None:
        self.target_similarity = target_similarity
        self._face_app: Any | None = None
        self._insightface_failed = False

    def _insightface_app(self) -> Any | None:
        if self._insightface_failed:
            return None
        if self._face_app is not None:
            return self._face_app
        try:
            from insightface.app import FaceAnalysis  # type: ignore[import-untyped]
        except ImportError:
            self._insightface_failed = True
            return None
        try:
            app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
            app.prepare(ctx_id=0, det_size=(320, 320))
            self._face_app = app
            return app
        except Exception as exc:  # noqa: BLE001
            logger.warning("InsightFace init failed, using fallback likeness: %s", exc)
            self._insightface_failed = True
            return None

    def _insightface_similarity(self, reference: Path, generated: Path) -> float | None:
        app = self._insightface_app()
        if app is None:
            return None

        def _embedding(path: Path) -> np.ndarray | None:
            with Image.open(path) as img:
                rgb = np.asarray(img.convert("RGB"))
            faces = app.get(rgb)
            if not faces:
                return None
            emb = faces[0].normed_embedding
            return np.asarray(emb, dtype=np.float32)

        ref_emb = _embedding(reference)
        gen_emb = _embedding(generated)
        if ref_emb is None or gen_emb is None:
            return None
        denom = float(np.linalg.norm(ref_emb) * np.linalg.norm(gen_emb))
        if denom <= 0:
            return 0.0
        return float(np.dot(ref_emb, gen_emb) / denom)

    def _fallback_similarity(self, reference: Path, generated: Path) -> float:
        ref_vec = _rgb_vector(reference)
        gen_vec = _rgb_vector(generated)
        denom = float(np.linalg.norm(ref_vec) * np.linalg.norm(gen_vec))
        cosine = float(np.dot(ref_vec, gen_vec) / denom) if denom > 0 else 0.0
        cosine = max(0.0, min(1.0, (cosine + 1.0) / 2.0))

        ref_hash = compute_phash(reference)
        gen_hash = compute_phash(generated)
        phash = phash_similarity(ref_hash, gen_hash)

        return round(0.55 * cosine + 0.45 * phash, 4)

    def compare(self, reference: Path, generated: Path) -> dict[str, Any]:
        if not reference.is_file():
            return {"ok": False, "reason": "reference_missing", "similarity": 0.0, "passed": False}
        if not generated.is_file():
            return {"ok": False, "reason": "generated_missing", "similarity": 0.0, "passed": False}

        insight = self._insightface_similarity(reference, generated)
        if insight is not None:
            similarity = round(max(0.0, min(1.0, insight)), 4)
            method = "insightface"
            target = INSIGHTFACE_TARGET
        else:
            similarity = self._fallback_similarity(reference, generated)
            method = "fallback"
            target = self.target_similarity

        passed = similarity >= target
        return {
            "ok": True,
            "similarity": similarity,
            "target": target,
            "passed": passed,
            "method": method,
        }