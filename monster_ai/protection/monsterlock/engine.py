"""MonsterLock engine v2 — hardened anti-copy + anti-tamper orchestrator."""
from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Awaitable, Callable

from monster_ai.config import MonsterLockSettings
from monster_ai.protection.monsterlock.anti_debug import scan_environment
from monster_ai.protection.monsterlock.behavior_monitor import save_config_baseline, scan_behavior
from monster_ai.protection.monsterlock.config_guard import create_config_seal, verify_config_seal
from monster_ai.protection.monsterlock.credential_bridge import RapidCredentialShield
from monster_ai.protection.monsterlock.crypto import derive_static_key, wipe_bytes
from monster_ai.protection.monsterlock.hardware import collect_hardware_profile
from monster_ai.protection.monsterlock.integrity import (
    DEFAULT_PROTECTED_PATHS,
    build_manifest,
    load_manifest,
    repair_from_backup,
    save_manifest,
    verify_manifest,
)
from monster_ai.protection.monsterlock.key_vault import RuntimeKeyVault
from monster_ai.protection.monsterlock.self_destruct import execute_self_destruct
from monster_ai.protection.monsterlock.signatures import SignatureStore
from monster_ai.protection.monsterlock.vault import SecureVault
from monster_ai.protection.notifications.hub import NotificationHub, SecurityAlert

logger = logging.getLogger(__name__)


@dataclass
class MonsterLockState:
    enabled: bool = False
    armed: bool = False
    hardware_bound: bool = False
    fingerprint: str = ""
    fingerprint_short: str = ""
    strength: str = "standard"
    hardened: bool = False
    self_destruct_mode: bool = False
    config_guard_active: bool = False
    dpapi_active: bool = False
    nuitka_build: bool = False
    last_integrity_ok: bool = True
    last_threat_score: int = 0
    last_behavior_score: int = 0
    checks: int = 0
    repairs: int = 0
    blocks: int = 0
    destruct_count: int = 0
    last_error: str | None = None
    credential_generation: int = 0


class MonsterLockEngine:
    def __init__(
        self,
        settings: MonsterLockSettings,
        root: Path,
        notify: NotificationHub | None = None,
        on_tamper: Callable[[list[str]], Awaitable[None]] | None = None,
    ) -> None:
        self.settings = settings
        self.root = root
        self.notify = notify
        self.on_tamper = on_tamper
        self.state = MonsterLockState()
        self._profile = None
        self._signing_key: bytes | None = None
        self._key_vault: RuntimeKeyVault | None = None
        self._credential: RapidCredentialShield | None = None
        self._vault: SecureVault | None = None
        self._sig_store: SignatureStore | None = None
        self._task: asyncio.Task | None = None
        self._events: list[dict[str, Any]] = []
        self._destroyed = False
        self._data_dir = root / settings.data_dir.lstrip("./")
        self._manifest_path = self._data_dir / "manifest.json"
        self._signed_manifest_path = self._data_dir / "manifest.signed.json"
        self._binding_path = self._data_dir / "hardware.binding"
        self._backup_dir = self._data_dir / "backup"
        self._baseline_path = self._data_dir / "config_baseline.json"

    def _record_event(self, level: str, message: str, **extra: Any) -> None:
        record = {"ts": time.time(), "level": level, "message": message, **extra}
        self._events.append(record)
        self._events = self._events[-200:]

    async def _alert(self, level: str, message: str, **extra: Any) -> None:
        self._record_event(level, message, **extra)
        if self.notify:
            await self.notify.notify(
                SecurityAlert(level=level, message=message, action="monsterlock", extra=extra)
            )

    def _trigger_self_destruct(self, reason: str, *, exit_process: bool = False) -> None:
        if self._destroyed:
            return
        self._destroyed = True
        self.state.destruct_count += 1
        self.state.armed = False

        def _wipe() -> None:
            if self._key_vault:
                self._key_vault.wipe_all()
            if self._signing_key:
                wipe_bytes(self._signing_key)

        assets = list(self.settings.asset_paths)
        assets.extend(self.settings.protected_paths or DEFAULT_PROTECTED_PATHS)
        report = execute_self_destruct(
            self.root,
            self._data_dir,
            asset_paths=assets,
            reason=reason,
            key_vault_wipe=_wipe,
            corrupt_models=self.settings.corrupt_assets_on_destruct,
            exit_process=exit_process and self.settings.force_exit_on_destruct,
        )
        self._record_event("block", f"SELF-DESTRUCT: {reason}", report=report.to_dict())

    def bootstrap(self) -> bool:
        if not self.settings.enabled:
            self.state.enabled = False
            return True

        self.state.enabled = True
        self.state.strength = self.settings.strength
        self.state.hardened = self.settings.hardened_mode
        self.state.self_destruct_mode = self.settings.self_destruct_enabled
        self.state.nuitka_build = (self.root / "dist" / "monsterlock_native").exists()

        config_path = self.root / "config.yaml"
        if self.settings.config_guard_enabled and config_path.exists():
            ok, reason = verify_config_seal(config_path, self._data_dir)
            self.state.config_guard_active = True
            if not ok:
                msg = f"Config guard violation: {reason}"
                self.state.last_error = msg
                self._record_event("block", msg)
                if self.settings.self_destruct_on_tamper:
                    self._trigger_self_destruct(msg)
                if self.settings.block_on_tamper or self.settings.hardened_mode:
                    return False

        try:
            self._profile = collect_hardware_profile(bind_gpu=self.settings.bind_gpu)
            self.state.fingerprint = self._profile.fingerprint
            self.state.fingerprint_short = self._profile.short_id()
            self._key_vault = RuntimeKeyVault(self._profile.fingerprint, self._data_dir)
            self._key_vault.derive_master_key()
            self.state.dpapi_active = (self._data_dir / "sealed_entropy.bin").exists()
            self._signing_key = derive_static_key(self._profile.fingerprint)
            self._sig_store = SignatureStore(self._data_dir)
            self._vault = SecureVault(
                self._profile.fingerprint,
                self._data_dir / "vault",
                key_vault=self._key_vault,
            )
            self._credential = RapidCredentialShield(
                fingerprint=self._profile.fingerprint,
                rotation_interval=self.settings.credential_rotation_seconds,
                token_ttl=self.settings.credential_ttl_seconds,
                store_path=self._data_dir / "credentials.json",
            )
        except Exception as exc:  # noqa: BLE001
            self.state.last_error = str(exc)
            logger.error("MonsterLock bootstrap failed: %s", exc)
            return not self.settings.block_on_mismatch

        if not self._verify_hardware_binding():
            msg = "Hardware binding mismatch"
            self.state.last_error = msg
            self._record_event("block", msg)
            if self.settings.self_destruct_on_tamper:
                self._trigger_self_destruct(msg)
            if self.settings.block_on_mismatch:
                return False

        self.state.hardware_bound = True

        if self.settings.anti_debug_enabled:
            threat = scan_environment(
                strength=self.settings.strength,
                block_threshold=self.settings.anti_debug_block_threshold,
            )
            self.state.last_threat_score = threat.score
            if threat.should_block:
                msg = f"Anti-analysis: {', '.join(threat.threats)}"
                self.state.last_error = msg
                self.state.blocks += 1
                self._record_event("block", msg, threats=threat.threats)
                if self.settings.self_destruct_on_analysis:
                    self._trigger_self_destruct(msg, exit_process=True)
                if self.settings.block_on_analysis:
                    return False

        if self.settings.behavior_monitor_enabled:
            behavior = scan_behavior(self.root, self._baseline_path)
            self.state.last_behavior_score = behavior.score
            if behavior.triggered:
                msg = f"Behavior anomaly: {behavior.anomalies}"
                self._record_event("warn", msg)
                if self.settings.self_destruct_on_tamper:
                    self._trigger_self_destruct(msg)
                    return False

        integrity_ok = self._check_integrity_sync(repair=self.settings.auto_repair)
        self.state.last_integrity_ok = integrity_ok
        if not integrity_ok:
            if self.settings.self_destruct_on_tamper:
                self._trigger_self_destruct("integrity_failure")
            if self.settings.block_on_tamper:
                return False

        if self.settings.config_guard_enabled and config_path.exists():
            if not (self._data_dir / "config.seal").exists():
                create_config_seal(config_path, self._data_dir)
            save_config_baseline(self.root, self._baseline_path)

        self.state.armed = not self._destroyed
        self._record_event("ok", "MonsterLock v2 armed", fingerprint=self.state.fingerprint_short)
        return not self._destroyed

    def _verify_hardware_binding(self) -> bool:
        if not self.settings.hardware_binding:
            return True
        if not self._binding_path.exists():
            if self.settings.auto_bind_on_first_run:
                self._binding_path.parent.mkdir(parents=True, exist_ok=True)
                self._binding_path.write_text(
                    json.dumps(
                        {
                            "fingerprint": self._profile.fingerprint if self._profile else "",
                            "bound_at": time.time(),
                            "gpu": self._profile.gpu_name if self._profile else "",
                            "version": 2,
                        },
                        indent=2,
                    ),
                    encoding="utf-8",
                )
                return True
            return not self.settings.require_binding_file
        try:
            data = json.loads(self._binding_path.read_text(encoding="utf-8"))
            return data.get("fingerprint", "") == (self._profile.fingerprint if self._profile else "")
        except (OSError, json.JSONDecodeError):
            return False

    def _refresh_manifests(self, paths: list[str]) -> None:
        if not self._signing_key:
            return
        manifest = build_manifest(self.root, paths, self._signing_key)
        save_manifest(self._manifest_path, manifest)
        self._backup_protected_files(paths)
        if self.settings.digital_signatures_enabled and self._sig_store:
            signed = self._sig_store.build_signed_manifest(self.root, paths)
            self._signed_manifest_path.write_text(json.dumps(signed, indent=2), encoding="utf-8")

    def _check_integrity_sync(self, *, repair: bool) -> bool:
        if not self.settings.integrity_check_enabled:
            return True
        paths = self.settings.protected_paths or DEFAULT_PROTECTED_PATHS

        if self.settings.digital_signatures_enabled and self._sig_store:
            if not self._signed_manifest_path.exists():
                self._refresh_manifests(paths)
            else:
                signed = json.loads(self._signed_manifest_path.read_text(encoding="utf-8"))
                ok, bad = self._sig_store.verify_manifest(self.root, signed)
                if not ok:
                    self._record_event("warn", f"Signature violation: {bad}")
                    if repair:
                        backup_report = repair_from_backup(self.root, bad, self._backup_dir)
                        self.state.repairs += len(backup_report.repaired)
                        ok, _ = self._sig_store.verify_manifest(self.root, signed)
                    if not ok:
                        return False

        if not self._signing_key:
            return True
        manifest = load_manifest(self._manifest_path)
        if not manifest.get("entries"):
            self._refresh_manifests(paths)
            return True

        report = verify_manifest(self.root, manifest, self._signing_key)
        if report.ok:
            return True

        tampered = report.tampered + report.missing
        self._record_event("warn", f"Integrity violation: {tampered}")
        if repair and tampered:
            backup_report = repair_from_backup(self.root, tampered, self._backup_dir)
            self.state.repairs += len(backup_report.repaired)
            report = verify_manifest(self.root, manifest, self._signing_key)
            if report.ok:
                return True
        return False

    def _backup_protected_files(self, paths: list[str]) -> None:
        for rel in paths:
            src = self.root / rel
            if not src.is_file():
                continue
            dst = self._backup_dir / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            try:
                dst.write_bytes(src.read_bytes())
            except OSError as exc:
                logger.warning("Backup failed for %s: %s", rel, exc)

    async def start(self) -> None:
        if not self.settings.enabled or not self.state.armed:
            return
        await self._cycle_once()
        self._task = asyncio.create_task(self._loop())

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        if self._vault:
            self._vault.wipe()
        if self._credential:
            self._credential.wipe()
        if self._key_vault:
            self._key_vault.wipe_all()
        if self._signing_key:
            wipe_bytes(self._signing_key)
            self._signing_key = None

    async def _loop(self) -> None:
        while True:
            await asyncio.sleep(self.settings.check_interval_seconds)
            await self._cycle_once()

    async def _cycle_once(self) -> None:
        if self._destroyed:
            return
        self.state.checks += 1

        if self.settings.anti_debug_enabled:
            threat = scan_environment(
                strength=self.settings.strength,
                block_threshold=self.settings.anti_debug_block_threshold,
            )
            self.state.last_threat_score = threat.score
            if threat.should_block:
                self.state.blocks += 1
                await self._alert("block", f"Runtime threat: {threat.threats}")
                if self.settings.self_destruct_on_analysis:
                    self._trigger_self_destruct(f"runtime:{threat.threats}", exit_process=True)
                elif self.on_tamper:
                    await self.on_tamper(threat.threats)

        if self.settings.behavior_monitor_enabled:
            behavior = scan_behavior(self.root, self._baseline_path)
            self.state.last_behavior_score = behavior.score
            if behavior.triggered:
                await self._alert("warn", f"Behavior: {behavior.anomalies}")
                if self.settings.self_destruct_on_tamper:
                    self._trigger_self_destruct(f"behavior:{behavior.anomalies}")

        if self._credential and self.settings.credential_rotation_enabled:
            self._credential.rotate()
            if self._key_vault:
                self._key_vault.rotate_session_key()
            self.state.credential_generation = self._credential._generation

        if self.settings.integrity_check_enabled:
            ok = self._check_integrity_sync(repair=self.settings.auto_repair)
            self.state.last_integrity_ok = ok
            if not ok:
                await self._alert("warn", "Integrity check failed")
                if self.settings.self_destruct_on_tamper:
                    self._trigger_self_destruct("integrity_runtime")
                elif self.on_tamper:
                    await self.on_tamper(["integrity_failure"])

        if self.settings.config_guard_enabled:
            config_path = self.root / "config.yaml"
            if config_path.exists():
                seal_ok, reason = verify_config_seal(config_path, self._data_dir)
                if not seal_ok:
                    await self._alert("block", f"Config tamper: {reason}")
                    if self.settings.self_destruct_on_tamper:
                        self._trigger_self_destruct(f"config:{reason}")

    @property
    def vault(self) -> SecureVault | None:
        return self._vault

    def recent_events(self, limit: int = 20) -> list[dict[str, Any]]:
        return list(reversed(self._events[-limit:]))

    def to_dict(self) -> dict[str, Any]:
        cred = self._credential.to_dict() if self._credential else None
        return {
            "enabled": self.state.enabled,
            "armed": self.state.armed,
            "status": "protected" if self.state.armed else "inactive",
            "green_dot": self.state.armed and self.state.last_integrity_ok and not self._destroyed,
            "hardware_bound": self.state.hardware_bound,
            "fingerprint_short": self.state.fingerprint_short,
            "strength": self.state.strength,
            "hardened": self.state.hardened,
            "config_guard_active": self.state.config_guard_active,
            "dpapi_active": self.state.dpapi_active,
            "nuitka_build": self.state.nuitka_build,
            "self_destruct_mode": self.state.self_destruct_mode,
            "last_integrity_ok": self.state.last_integrity_ok,
            "last_threat_score": self.state.last_threat_score,
            "last_behavior_score": self.state.last_behavior_score,
            "checks": self.state.checks,
            "repairs": self.state.repairs,
            "blocks": self.state.blocks,
            "destruct_count": self.state.destruct_count,
            "last_error": self.state.last_error,
            "rapid_credential_shield": cred,
            "events": self.recent_events(10),
        }