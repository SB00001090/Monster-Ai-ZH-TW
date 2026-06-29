"""Tests for MonsterLock v2 protection module."""
from __future__ import annotations

from pathlib import Path

import pytest

from monster_ai.config import MonsterLockSettings
from monster_ai.protection.monsterlock.anti_debug import scan_environment
from monster_ai.protection.monsterlock.config_guard import create_config_seal, verify_config_seal
from monster_ai.protection.monsterlock.crypto import decrypt_bytes, encrypt_bytes
from monster_ai.protection.monsterlock.hardware import _derive_fingerprint
from monster_ai.protection.monsterlock.integrity import build_manifest, verify_manifest
from monster_ai.protection.monsterlock.credential_bridge import RapidCredentialShield
from monster_ai.protection.monsterlock.engine import MonsterLockEngine
from monster_ai.protection.monsterlock.key_vault import RuntimeKeyVault
from monster_ai.protection.monsterlock.layered_crypto import decrypt_file_layered, encrypt_file_layered
from monster_ai.protection.monsterlock.self_destruct import execute_self_destruct


def _test_settings(**overrides) -> MonsterLockSettings:
    base = dict(
        enabled=True,
        hardware_binding=True,
        auto_bind_on_first_run=True,
        block_on_mismatch=True,
        block_on_analysis=False,
        anti_debug_enabled=False,
        behavior_monitor_enabled=False,
        integrity_check_enabled=True,
        digital_signatures_enabled=False,
        config_guard_enabled=False,
        self_destruct_on_tamper=False,
        self_destruct_on_analysis=False,
        block_on_tamper=False,
        corrupt_assets_on_destruct=False,
    )
    base.update(overrides)
    return MonsterLockSettings(**base)


def test_fingerprint_stable() -> None:
    a = _derive_fingerprint({"cpu": "abc", "board": "xyz"})
    b = _derive_fingerprint({"cpu": "abc", "board": "xyz"})
    assert a == b
    assert len(a) == 64


def test_aes_roundtrip() -> None:
    fp = "test-fingerprint-12345678"
    plain = b"Monster AI secret workflow data"
    enc = encrypt_bytes(plain, fp)
    dec = decrypt_bytes(enc, fp)
    assert dec == plain


def test_layered_roundtrip(tmp_path: Path) -> None:
    src = tmp_path / "model.safetensors"
    src.write_bytes(b"x" * 5000)
    dst = tmp_path / "model.safetensors.mlck3"
    master = b"m" * 32
    session = b"s" * 32
    encrypt_file_layered(src, dst, master, session)
    out = decrypt_file_layered(dst, master, session)
    assert out == src.read_bytes()


def test_key_vault_derive() -> None:
    vault = RuntimeKeyVault("test-fp-abc", Path("./data/monsterlock_test"))
    k1 = vault.derive_master_key()
    k2 = vault.derive_master_key()
    assert k1 == k2
    vault.wipe_all()


def test_manifest_sign_and_verify(tmp_path: Path) -> None:
    f = tmp_path / "monster_ai" / "test.py"
    f.parent.mkdir(parents=True)
    f.write_text("print('ok')", encoding="utf-8")
    key = b"0" * 32
    manifest = build_manifest(tmp_path, ["monster_ai/test.py"], key)
    assert verify_manifest(tmp_path, manifest, key).ok
    f.write_text("tampered", encoding="utf-8")
    assert not verify_manifest(tmp_path, manifest, key).ok


def test_credential_rotation() -> None:
    shield = RapidCredentialShield(fingerprint="fp-test", rotation_interval=0.1, token_ttl=1.0)
    t1 = shield.rotate()
    t2 = shield.rotate()
    assert t1.token_id != t2.token_id
    assert shield.verify(t2.token_id)
    shield.wipe()


def test_engine_bootstrap_disabled(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.chdir(tmp_path)
    engine = MonsterLockEngine(MonsterLockSettings(enabled=False), tmp_path)
    assert engine.bootstrap()
    assert not engine.state.armed


def test_engine_bootstrap_enabled(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.chdir(tmp_path)
    (tmp_path / "data" / "monsterlock").mkdir(parents=True)
    engine = MonsterLockEngine(_test_settings(), tmp_path)
    assert engine.bootstrap()
    assert engine.state.armed


def test_config_guard_blocks_tamper(tmp_path: Path) -> None:
    import yaml

    config = tmp_path / "config.yaml"
    data_dir = tmp_path / "data" / "monsterlock"
    data_dir.mkdir(parents=True)
    data = {
        "protection": {
            "monsterlock": {
                "enabled": True,
                "config_guard_enabled": True,
                "strength": "strict",
            }
        }
    }
    config.write_text(yaml.dump(data), encoding="utf-8")
    create_config_seal(config, data_dir)
    assert verify_config_seal(config, data_dir)[0]

    data["protection"]["monsterlock"]["enabled"] = False
    config.write_text(yaml.dump(data), encoding="utf-8")
    ok, reason = verify_config_seal(config, data_dir)
    assert not ok
    assert "tampered" in reason or "disabled" in reason


def test_self_destruct_corrupts(tmp_path: Path) -> None:
    asset = tmp_path / "data" / "models" / "lora" / "test.safetensors"
    asset.parent.mkdir(parents=True)
    original = b"header" + b"\x00" * 1000
    asset.write_bytes(original)
    data_dir = tmp_path / "data" / "monsterlock"
    report = execute_self_destruct(
        tmp_path,
        data_dir,
        asset_paths=["data/models/lora"],
        reason="test",
        corrupt_models=True,
    )
    assert report.corrupted_files
    assert asset.read_bytes() != original
    assert (data_dir / "LOCKED").exists()


def test_anti_debug_light_mode() -> None:
    result = scan_environment(strength="light", block_threshold=999)
    assert result.score >= 0