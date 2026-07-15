"""Guardian ↔ image generation pipeline integration."""
from __future__ import annotations

from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock

import pytest
from PIL import Image

from monster_ai.config import load_settings
from monster_ai.modules.guardian.service import GuardianService
from monster_ai.modules.image.likeness_scorer import FaceLikenessScorer
from monster_ai.modules.image.quality import QualityReport


@pytest.fixture
def guardian_svc(tmp_path):
    root = tmp_path / "data" / "guardian"
    root.mkdir(parents=True)
    settings = load_settings()
    settings.guardian.enabled = True
    settings.guardian.data_dir = str(root)
    settings.guardian.training_encryption_enabled = True
    return GuardianService(settings.guardian, repo_root=tmp_path)


@pytest.mark.asyncio
async def test_generate_attaches_guardian_quality_gate(tmp_path, monkeypatch):
    from monster_ai.modules.image.comfyui import ImageService

    out_dir = tmp_path / "outputs"
    out_dir.mkdir()
    img_path = out_dir / "out.png"
    Image.new("RGB", (64, 64), color=(100, 150, 200)).save(img_path)

    settings = load_settings()
    settings.modules.image.enabled = True
    settings.modules.image.output_dir = str(out_dir)
    settings.modules.image.quality.enabled = True
    settings.modules.image.quality.max_retries = 0

    guardian_root = tmp_path / "guardian"
    guardian_root.mkdir()
    settings.guardian.data_dir = str(guardian_root)
    guardian = GuardianService(settings.guardian, repo_root=tmp_path)

    quality_report = QualityReport(passed=True, score=0.88, rule_score=0.88)
    mock_scorer = MagicMock()
    mock_scorer.evaluate.return_value = quality_report

    svc = ImageService(
        settings,
        repair=MagicMock(),
        gen_repair=MagicMock(),
        vram_guard=MagicMock(),
        prompt_enhancer=MagicMock(),
        quality_scorer=mock_scorer,
        quality_store=MagicMock(),
        image_repair=MagicMock(),
        prompt_refiner=MagicMock(),
        guardian_svc=guardian,
        likeness_scorer=FaceLikenessScorer(target_similarity=0.5),
    )
    svc.settings.modules.image.quality.reject_bad_output = False
    svc.image_repair.record_quality_pass = MagicMock()
    svc.image_repair.record_quality_fail = MagicMock()
    svc.image_repair.should_escalate = MagicMock(return_value=False)
    svc.image_repair.plan_retry = MagicMock()
    svc.quality_store.save_good = MagicMock()
    svc.quality_store.save_bad = MagicMock()
    svc.prompt_refiner.refine = AsyncMock(return_value=MagicMock(positive="p", negative="n", steps_delta=0, cfg_delta=0))
    svc.list_loras = AsyncMock(return_value=[])
    svc.client.resolve_checkpoint_name = AsyncMock(return_value=("test.safetensors", None))
    svc.client.list_checkpoints = AsyncMock(return_value=["test.safetensors"])
    svc.prompt_enhancer.for_image = AsyncMock(return_value="styled prompt")
    svc.prompt_enhancer.default_negative = MagicMock(return_value="neg")
    svc.gen_repair.run = AsyncMock(return_value=img_path)
    svc.gen_repair.state = MagicMock(quality_fail_streak=0, last_quality_score=None)
    @asynccontextmanager
    async def _acquire(_label: str):
        yield

    svc.vram_guard.acquire = _acquire

    result = await svc.generate(
        "test prompt",
        quality_filter=True,
        owner_id="user-1",
        character_id="oc-9",
    )

    assert "guardian" in result
    assert result["guardian"]["quality_gate"]["passed"] is True
    assert result["guardian"]["image_fingerprint"]["ok"] is True
    assert result["guardian"]["image_fingerprint"]["phash"]
    assert "success_tracker" in result["guardian"]
    assert result["guardian"]["success_tracker"]["total_recorded"] >= 1