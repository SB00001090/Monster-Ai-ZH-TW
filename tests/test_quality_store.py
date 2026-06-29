"""Tests for quality dataset store."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

from monster_ai.config import ImageQualitySettings
from monster_ai.modules.image.quality import QualityReport
from monster_ai.modules.image.quality_store import QualityStore


def test_archive_bad_and_good(tmp_path: Path) -> None:
    settings = ImageQualitySettings(data_dir=str(tmp_path / "quality"))
    store = QualityStore(settings.data_dir, settings)
    src = tmp_path / "src.png"
    arr = np.zeros((64, 64, 3), dtype=np.uint8)
    Image.fromarray(arr).save(src)
    report = QualityReport(passed=False, score=0.1, issues=[], reasons=["test"])

    bad = store.save_bad(
        src, prompt="test", negative="neg", report=report, checkpoint="ckpt", attempt=0
    )
    assert bad is not None
    assert bad.exists()
    assert store.log_path.exists()
    assert "bad" in store.log_path.read_text(encoding="utf-8")

    report_ok = QualityReport(passed=True, score=0.9)
    good = store.save_good(
        src, prompt="test", negative="neg", report=report_ok, checkpoint="ckpt", attempt=1
    )
    assert good is not None
    assert (store.good_dir / good.name).exists()