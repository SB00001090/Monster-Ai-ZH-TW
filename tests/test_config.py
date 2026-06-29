import os

import pytest
import yaml

from monster_ai.config import load_settings


@pytest.fixture
def config_with_profiles(tmp_path):
    data = {
        "llm": {"model": "default:1b", "num_ctx": 2048},
        "profiles": {
            "rtx_4060": {"model": "llama3.2:3b", "num_ctx": 4096},
            "rtx_4090": {"model": "llama3.1:8b", "num_ctx": 8192},
        },
    }
    path = tmp_path / "config.yaml"
    path.write_text(yaml.dump(data), encoding="utf-8")
    return path


def test_gpu_profile_applies_llm_settings(config_with_profiles, monkeypatch):
    monkeypatch.setenv("MONSTER_GPU_PROFILE", "rtx_4090")
    settings = load_settings(config_with_profiles)
    assert settings.llm.model == "llama3.1:8b"
    assert settings.llm.num_ctx == 8192


def test_env_override_beats_gpu_profile(config_with_profiles, monkeypatch):
    monkeypatch.setenv("MONSTER_GPU_PROFILE", "rtx_4060")
    monkeypatch.setenv("MONSTER_LLM_MODEL", "custom:7b")
    settings = load_settings(config_with_profiles)
    assert settings.llm.model == "custom:7b"
    assert settings.llm.num_ctx == 4096