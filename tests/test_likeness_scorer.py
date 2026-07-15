"""Face likeness scorer tests."""
from __future__ import annotations

import io

from PIL import Image

from monster_ai.modules.image.likeness_scorer import FaceLikenessScorer


def _write_png(path, color: tuple[int, int, int]) -> None:
    Image.new("RGB", (128, 128), color=color).save(path, format="PNG")


def test_identical_images_high_similarity(tmp_path):
    ref = tmp_path / "ref.png"
    gen = tmp_path / "gen.png"
    _write_png(ref, (90, 120, 200))
    _write_png(gen, (90, 120, 200))

    result = FaceLikenessScorer(target_similarity=0.5).compare(ref, gen)
    assert result["ok"] is True
    assert result["method"] == "fallback"
    assert result["similarity"] >= 0.9
    assert result["passed"] is True


def test_different_images_lower_similarity(tmp_path):
    ref = tmp_path / "ref.png"
    gen = tmp_path / "gen.png"
    _write_png(ref, (20, 40, 220))
    _write_png(gen, (220, 180, 10))

    result = FaceLikenessScorer(target_similarity=0.85).compare(ref, gen)
    assert result["ok"] is True
    assert result["similarity"] < 0.85
    assert result["passed"] is False