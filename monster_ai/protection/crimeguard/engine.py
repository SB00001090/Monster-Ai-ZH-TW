"""CrimeGuard engine — HK crime intent + device contact + VPN + network lock."""
from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from monster_ai.config import CrimeGuardSettings
from monster_ai.protection.crimeguard.device_contact import DeviceContactScanResult, scan_device_contact
from monster_ai.protection.crimeguard.device_lock import apply_device_lock, release_device_lock
from monster_ai.protection.crimeguard.network_lock import (
    apply_network_lock,
    is_network_locked,
    load_lock_state,
    release_network_lock,
)
from monster_ai.protection.crimeguard.rules import IntentResult, load_hk_rules, llm_analyze_prompt, score_prompt
from monster_ai.protection.crimeguard.vpn_detector import VpnScanResult, scan_vpn
from monster_ai.protection.notifications.hub import NotificationHub, SecurityAlert

logger = logging.getLogger(__name__)


@dataclass
class CrimeGuardState:
    enabled: bool = False
    armed: bool = False
    network_locked: bool = False
    device_locked: bool = False
    vpn_detected: bool = False
    vpn_type: str = ""
    device_contact_detected: bool = False
    device_contact_type: str = ""
    lock_mode: str = ""
    high_risk_blocked: bool = False
    last_intent_score: int = 0
    last_vpn_score: int = 0
    last_device_contact_score: int = 0
    blocks: int = 0
    locks_triggered: int = 0
    checks: int = 0


class CrimeGuardEngine:
    def __init__(
        self,
        settings: CrimeGuardSettings,
        root: Path,
        notify: NotificationHub | None = None,
        repair_engine: Any | None = None,
        monsterlock: Any | None = None,
    ) -> None:
        self.settings = settings
        self.root = root
        self.notify = notify
        self.repair = repair_engine
        self.monsterlock = monsterlock
        self.state = CrimeGuardState()
        self._data_dir = root / settings.data_dir.lstrip("./")
        self._rules_path = self._data_dir / "hk_rules.yaml"
        self._exit_nodes_path = self._data_dir / "vpn_exit_nodes.yaml"
        self._events: list[dict[str, Any]] = []
        self._task: asyncio.Task | None = None
        self._rules = load_hk_rules(self._rules_path)
        self.state.network_locked = is_network_locked(self._data_dir)

    def _record(self, level: str, message: str, **extra: Any) -> None:
        record = {"ts": time.time(), "level": level, "message": message, **extra}
        self._events.append(record)
        self._events = self._events[-300:]

    async def _alert(self, level: str, message: str, **extra: Any) -> None:
        self._record(level, message, **extra)
        if self.notify:
            await self.notify.notify(
                SecurityAlert(level=level, message=message, action="crimeguard", extra=extra)
            )

    def reload_rules(self) -> None:
        self._rules = load_hk_rules(self._rules_path)

    async def start(self) -> None:
        if not self.settings.enabled:
            return
        self.state.enabled = True
        self.state.armed = True
        self.state.network_locked = is_network_locked(self._data_dir)
        await self._scan_vpn_once()
        await self._scan_device_contact_once()
        self._task = asyncio.create_task(self._loop())

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _loop(self) -> None:
        interval = min(
            self.settings.vpn_scan_interval_seconds,
            self.settings.device_contact_scan_interval_seconds
            if self.settings.device_contact_detection_enabled
            else self.settings.vpn_scan_interval_seconds,
        )
        while True:
            await asyncio.sleep(interval)
            if self.settings.vpn_detection_enabled:
                await self._scan_vpn_once()
            if self.settings.device_contact_detection_enabled:
                await self._scan_device_contact_once()

    async def _scan_vpn_once(self) -> VpnScanResult:
        self.state.checks += 1
        vpn = scan_vpn(exit_nodes_path=self._exit_nodes_path)
        self.state.vpn_detected = vpn.detected
        self.state.last_vpn_score = vpn.score
        self.state.vpn_type = vpn.vpn_type
        if vpn.detected:
            self._record("warn", f"VPN detected: {vpn.vpn_type or 'unknown'}", vpn=vpn.to_dict())
        return vpn

    async def _scan_device_contact_once(self) -> DeviceContactScanResult:
        contact = scan_device_contact(
            require_usb_or_bt=self.settings.device_contact_require_usb_or_bt,
            min_active_connections=self.settings.device_contact_min_connections,
        )
        self.state.device_contact_detected = contact.detected
        self.state.last_device_contact_score = contact.score
        self.state.device_contact_type = contact.contact_type
        if contact.detected:
            self._record(
                "warn",
                f"Device contact: {contact.contact_type or 'active'}",
                device_contact=contact.to_dict(),
            )
        return contact

    async def analyze_prompt(self, text: str, *, source: str = "chat") -> IntentResult:
        """Analyze user prompt for HK crime intent."""
        if not self.settings.enabled:
            return IntentResult()

        llm_ok = self.settings.llm_analysis_enabled and (
            not self.repair or getattr(self.repair, "llm_analysis_enabled", True)
        )
        if self.repair and llm_ok:
            result = await llm_analyze_prompt(text, self.repair, enabled=True)
        else:
            result = score_prompt(text, self._rules)

        self.state.last_intent_score = result.score

        if result.blocked:
            self.state.blocks += 1
            await self._alert(
                "block",
                f"Crime intent blocked ({result.score})",
                source=source,
                summary=result.summary,
                prompt_preview=text[:120],
                categories=result.categories,
            )

        vpn = await self._scan_vpn_once() if self.settings.vpn_scan_on_prompt else VpnScanResult()
        contact = (
            await self._scan_device_contact_once()
            if self.settings.device_contact_scan_on_prompt
            else DeviceContactScanResult()
        )

        should_lock = False
        lock_reason = result.summary or "high_risk_crime"

        if result.lock_trigger and self.settings.auto_lock_on_crime:
            should_lock = True

        if (
            self.settings.device_contact_lock_on_high_risk
            and contact.detected
            and result.score >= self.settings.device_contact_lock_min_score
        ):
            should_lock = True
            lock_reason = f"{lock_reason} + 設備聯繫"
            result.summary = lock_reason

        if (
            self.settings.vpn_lock_on_high_risk
            and vpn.detected
            and result.score >= self.settings.vpn_lock_min_score
        ):
            should_lock = True
            lock_reason = f"{lock_reason} + VPN"
            result.summary = lock_reason

        if should_lock and self.settings.network_lock_enabled:
            await self._trigger_network_lock(
                reason=lock_reason,
                intent=result,
                vpn=vpn,
                contact=contact,
            )

        return result

    async def _trigger_network_lock(
        self,
        *,
        reason: str,
        intent: IntentResult,
        vpn: VpnScanResult,
        contact: DeviceContactScanResult | None = None,
    ) -> None:
        if self.state.network_locked:
            return
        lock = apply_network_lock(
            self._data_dir,
            mode=self.settings.lock_mode,
            allow_local_services=self.settings.allow_local_services,
        )
        self.state.network_locked = lock.success
        self.state.lock_mode = self.settings.lock_mode
        self.state.locks_triggered += 1
        self.state.high_risk_blocked = True

        device_lock_info: dict[str, Any] | None = None
        if self.settings.escalate_usb_bluetooth_lock and contact and contact.detected:
            dl = apply_device_lock(lock_usb=True, lock_bluetooth=True)
            self.state.device_locked = dl.success
            device_lock_info = dl.to_dict()

        await self._alert(
            "block",
            f"NETWORK LOCKED: {reason}",
            vpn_type=vpn.vpn_type,
            vpn_signals=vpn.signals[:5],
            device_contact=contact.to_dict() if contact else None,
            device_lock=device_lock_info,
            intent_score=intent.score,
            prompt_preview=intent.summary,
            lock=lock.to_dict(),
        )

        if self.monsterlock and hasattr(self.monsterlock, "_record_event"):
            self.monsterlock._record_event("block", f"CrimeGuard network lock: {reason}")

        if self.settings.escalate_self_repair_on_lock and self.monsterlock:
            cred = getattr(self.monsterlock, "_credential", None)
            if cred and hasattr(cred, "rotate"):
                cred.rotate()
                self._record("ok", "RapidCredentialShield rotated on lock escalation")

    def is_generation_allowed(self, prompt: str = "") -> tuple[bool, str]:
        if not self.settings.enabled:
            return True, ""
        if self.state.network_locked and self.settings.block_generation_when_locked:
            return False, "network_locked"
        if self.state.high_risk_blocked:
            return False, "high_risk_lock_active"
        if prompt and self.settings.block_generation_on_crime:
            r = score_prompt(prompt, self._rules)
            if r.blocked:
                return False, "crime_intent"
        return True, ""

    async def check_message_allowed(self, message: str) -> tuple[bool, str, IntentResult | None]:
        if not self.settings.enabled:
            return True, "", None
        if self.state.network_locked and self.settings.block_chat_when_locked:
            return False, "網絡已鎖定 — 高風險內容生成已禁止", None

        result = await self.analyze_prompt(message, source="chat")
        if result.blocked:
            return False, f"CrimeGuard 已阻擋：{result.summary or '香港非法收債/恐嚇相關內容'}", result
        return True, "", result

    async def manual_lock(self, reason: str = "manual_ui_lock") -> bool:
        """One-click network lock from Security Center UI."""
        if self.state.network_locked:
            return True
        vpn = await self._scan_vpn_once() if self.settings.vpn_detection_enabled else VpnScanResult()
        contact = (
            await self._scan_device_contact_once()
            if self.settings.device_contact_detection_enabled
            else DeviceContactScanResult()
        )
        intent = IntentResult(
            score=100,
            blocked=True,
            lock_trigger=True,
            categories=["manual_lock"],
            summary=reason,
        )
        await self._trigger_network_lock(
            reason=reason,
            intent=intent,
            vpn=vpn,
            contact=contact,
        )
        return self.state.network_locked

    def preview_prompt(self, text: str) -> IntentResult:
        """Score prompt without side effects (safe-mode UI preview)."""
        if not self.settings.enabled or not text.strip():
            return IntentResult()
        return score_prompt(text, self._rules)

    def emergency_unlock(self, token: str) -> tuple[bool, str]:
        ok = release_network_lock(
            self._data_dir,
            confirm_token=token,
            expected_token=self.settings.recovery_token,
        )
        if ok.success:
            self.state.network_locked = False
            self.state.high_risk_blocked = False
            if self.state.device_locked:
                release_device_lock()
                self.state.device_locked = False
            self._record("ok", "Network lock released (emergency recovery)")
        return ok.success, ok.message

    def recent_events(self, limit: int = 30) -> list[dict[str, Any]]:
        return list(reversed(self._events[-limit:]))

    def to_dict(self) -> dict[str, Any]:
        lock_state = load_lock_state(self._data_dir)
        contact_alert = (
            self.state.device_contact_detected
            and self.state.last_intent_score >= self.settings.device_contact_lock_min_score
        )
        red_dot = self.state.network_locked or contact_alert or (
            self.state.vpn_detected and self.state.last_intent_score >= self.settings.vpn_lock_min_score
        )
        status = "locked" if self.state.network_locked else "ok"
        if not self.state.network_locked and (self.state.vpn_detected or self.state.device_contact_detected):
            status = "alert"
        return {
            "enabled": self.state.enabled,
            "armed": self.state.armed,
            "status": status,
            "red_dot": red_dot,
            "green_dot": self.state.armed and not red_dot,
            "network_locked": self.state.network_locked,
            "device_locked": self.state.device_locked,
            "device_contact_detected": self.state.device_contact_detected,
            "device_contact_type": self.state.device_contact_type,
            "vpn_detected": self.state.vpn_detected,
            "vpn_type": self.state.vpn_type,
            "lock_mode": lock_state.get("mode", self.state.lock_mode),
            "last_intent_score": self.state.last_intent_score,
            "last_vpn_score": self.state.last_vpn_score,
            "last_device_contact_score": self.state.last_device_contact_score,
            "blocks": self.state.blocks,
            "locks_triggered": self.state.locks_triggered,
            "checks": self.state.checks,
            "rules_version": self._rules.get("version", "unknown"),
            "events": self.recent_events(12),
        }