from monster_ai.modules.image.model_presets import (
    apply_style_to_prompt,
    list_presets_for_api,
    resolve_style_preset,
)

AVAILABLE = [
    "Counterfeit-V3.0_fp16.safetensors",
    "cyberrealistic_final.safetensors",
    "v1-5-pruned-emaonly.safetensors",
]


def test_resolve_anime_prefers_counterfeit():
    ckpt, preset, warn = resolve_style_preset("anime", AVAILABLE)
    assert preset.id == "anime"
    assert ckpt == "Counterfeit-V3.0_fp16.safetensors"
    assert warn is None


def test_resolve_realistic_uses_sdxl():
    ckpt, preset, _ = resolve_style_preset("realistic", AVAILABLE)
    assert preset.id == "realistic"
    assert ckpt == "cyberrealistic_final.safetensors"


def test_apply_anime_prompt_prefix():
    preset = resolve_style_preset("anime", AVAILABLE)[1]
    out = apply_style_to_prompt("girl with sword", preset)
    assert "anime style" in out
    assert "girl with sword" in out


def test_list_presets_marks_availability():
    items = list_presets_for_api(AVAILABLE)
    by_id = {p["id"]: p for p in items}
    assert by_id["anime"]["available"] is True
    assert by_id["anime"]["checkpoint"] == "Counterfeit-V3.0_fp16.safetensors"
    assert by_id["realistic"]["available"] is True