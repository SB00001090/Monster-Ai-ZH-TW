import pytest

from monster_ai.modules.image.checkpoint_resolver import (
    AUTO,
    is_sdxl_checkpoint,
    resolve_checkpoint,
)


def test_auto_picks_first():
    active, warn = resolve_checkpoint(AUTO, ["a.safetensors", "b.safetensors"])
    assert active == "a.safetensors"


def test_exact_match():
    active, warn = resolve_checkpoint("b.safetensors", ["a.safetensors", "b.safetensors"])
    assert active == "b.safetensors"
    assert warn is None


def test_fallback_when_missing():
    active, warn = resolve_checkpoint("missing.safetensors", ["cyberrealistic_final.safetensors"])
    assert active == "cyberrealistic_final.safetensors"
    assert warn and "missing" in warn


def test_empty_raises():
    with pytest.raises(RuntimeError):
        resolve_checkpoint(AUTO, [])


def test_sdxl_heuristic():
    assert is_sdxl_checkpoint("cyberrealistic_final.safetensors")
    assert not is_sdxl_checkpoint("v1-5-pruned.safetensors")