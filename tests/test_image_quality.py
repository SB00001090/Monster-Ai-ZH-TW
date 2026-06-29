"""Tests for image quality scoring."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

from monster_ai.config import ImageQualitySettings
from monster_ai.modules.image.quality import ImageQualityScorer, QualityIssue


def _write_rgb(path: Path, arr: np.ndarray) -> None:
    Image.fromarray(arr.astype(np.uint8), mode="RGB").save(path)


def test_black_image_detected(tmp_path: Path) -> None:
    arr = np.zeros((128, 128, 3), dtype=np.uint8)
    path = tmp_path / "black.png"
    _write_rgb(path, arr)
    scorer = ImageQualityScorer(ImageQualitySettings())
    report = scorer.evaluate(path, "a cat on a sofa")
    assert not report.passed
    assert QualityIssue.BLACK_IMAGE in report.issues


def test_white_image_detected(tmp_path: Path) -> None:
    arr = np.full((128, 128, 3), 255, dtype=np.uint8)
    path = tmp_path / "white.png"
    _write_rgb(path, arr)
    scorer = ImageQualityScorer(ImageQualitySettings())
    report = scorer.evaluate(path, "landscape")
    assert not report.passed
    assert QualityIssue.WHITE_IMAGE in report.issues


def test_low_variance_detected(tmp_path: Path) -> None:
    arr = np.full((128, 128, 3), 128, dtype=np.uint8)
    path = tmp_path / "flat.png"
    _write_rgb(path, arr)
    scorer = ImageQualityScorer(ImageQualitySettings())
    report = scorer.evaluate(path, "portrait")
    assert not report.passed
    assert QualityIssue.LOW_VARIANCE in report.issues


def test_normal_image_passes_rules(tmp_path: Path) -> None:
    y, x = np.mgrid[0:128, 0:128]
    arr = np.stack(
        [
            (x * 1.2 + 30).astype(np.uint8),
            (y * 0.8 + 50).astype(np.uint8),
            ((x + y) * 0.5 + 20).astype(np.uint8),
        ],
        axis=2,
    )
    path = tmp_path / "ok.png"
    _write_rgb(path, arr)
    scorer = ImageQualityScorer(ImageQualitySettings())
    report = scorer.evaluate(path, "colorful scene")
    assert report.passed
    assert report.score > 0.5