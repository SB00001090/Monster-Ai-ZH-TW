"""Firewall engine: learning mode, active block, quarantine, voice harassment."""
from __future__ import annotations

import json
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from monster_ai.config import FirewallSettings, NotificationSettings
from monster_ai.protection.blocker import Blocker
from monster_ai.protection.learner import LearnEvent, LearningAnalyzer
from monster_ai.protection.notifications.discord import DiscordNotifier
from monster_ai.protection.notifications.email import EmailNotifier
from monster_ai.protection.notifications.hub import NotificationHub, SecurityAlert
from monster_ai.protection.notifications.webui import WebUINotifier
from monster_ai.protection.quarantine import QuarantineZone
from monster_ai.protection.rule_generator import RuleGenerator
from monster_ai.protection.rules import score_request
from monster_ai.protection.voice_harassment import VoiceHarassmentDetector


@dataclass
class FirewallState:
    blocked_count: int = 0
    learned_count: int = 0
    allowed_count: int = 0
    last_event: dict[str, Any] | None = None


class FirewallEngine:
    def __init__(
        self,
        firewall: FirewallSettings,
        notifications: NotificationSettings,
        data_dir: Path | None = None,
    ) -> None:
        self.settings = firewall
        self.notifications_cfg = notifications
        base = data_dir or Path("./data/logs/security")
        base.mkdir(parents=True, exist_ok=True)

        self.blocker = Blocker(base / "banlist.json", firewall.ban_duration_minutes)
        self.quarantine = QuarantineZone(base / "quarantine")
        self.voice_harassment = VoiceHarassmentDetector(base / "voice", self.blocker)
        self.rule_generator = RuleGenerator(base, self.quarantine)
        self.learner = LearningAnalyzer(
            base / "learn.jsonl",
            escalate_count=firewall.learn_escalate_count,
            escalate_window_minutes=firewall.learn_escalate_window_minutes,
        )
        self.blocked_log = base / "blocked.jsonl"
        self.hub = NotificationHub()
        self.webui = WebUINotifier()
        self.hub.subscribe(self.webui.handle_alert)

        webhook = notifications.discord_webhook or ""
        if notifications.discord and webhook:
            self.hub.subscribe(DiscordNotifier(webhook).handle_alert)
        if notifications.email.enabled:
            self.hub.subscribe(
                EmailNotifier(
                    smtp_host=notifications.email.smtp_host,
                    smtp_port=notifications.email.smtp_port,
                    from_addr=notifications.email.from_addr,
                    to_addr=notifications.email.to,
                    password_env=notifications.email.password_env,
                ).handle_alert
            )

        self.state = FirewallState()
        self._req_times: dict[str, deque[float]] = defaultdict(deque)
        self._404_counts: dict[str, deque[tuple[float, int]]] = defaultdict(deque)

    def _is_whitelisted(self, ip: str) -> bool:
        return ip in set(self.settings.whitelist_ips)

    def _track_request(self, ip: str) -> int:
        now = time.monotonic()
        q = self._req_times[ip]
        q.append(now)
        while q and now - q[0] > 60:
            q.popleft()
        return len(q)

    def record_404(self, ip: str) -> int:
        now = time.monotonic()
        q = self._404_counts[ip]
        q.append((now, 1))
        while q and now - q[0][0] > 60:
            q.popleft()
        return sum(n for _, n in q)

    async def check_request(
        self,
        *,
        ip: str,
        path: str,
        method: str = "GET",
        query: str = "",
        body_preview: str = "",
    ) -> tuple[bool, str]:
        if not self.settings.enabled or self.settings.mode == "disabled":
            self.state.allowed_count += 1
            return True, "disabled"

        if self._is_whitelisted(ip):
            self.state.allowed_count += 1
            return True, "whitelisted"

        if self.blocker.is_banned(ip):
            self.state.blocked_count += 1
            return False, "banned"

        rpm = self._track_request(ip)
        recent_404 = self._404_counts.get(ip, deque())
        r404 = sum(n for t, n in recent_404 if time.monotonic() - t <= 60)

        threat = score_request(
            path=path,
            query=query,
            body_preview=body_preview,
            method=method,
            recent_404_count=r404,
            requests_last_minute=rpm,
        )

        block_threshold = self.settings.block_threshold
        learn_threshold = self.settings.learn_threshold

        if self.settings.mode == "active":
            learn_threshold = block_threshold

        if threat.score >= block_threshold:
            await self._block(ip, threat.score, threat.reasons, path, "active_block")
            return False, "blocked"

        if threat.score >= learn_threshold:
            self.learner.record(
                LearnEvent(
                    ip=ip,
                    score=threat.score,
                    reasons=threat.reasons,
                    path=path,
                    timestamp=time.time(),
                )
            )
            self.state.learned_count += 1
            await self.hub.notify(
                SecurityAlert(
                    level="warn",
                    message=f"Suspicious request: {', '.join(threat.reasons)}",
                    ip=ip,
                    action="logged",
                )
            )
            if self.learner.should_escalate(ip):
                await self._block(ip, threat.score, threat.reasons, path, "learn_escalate")
                return False, "escalated_block"

        self.state.allowed_count += 1
        return True, "ok"

    async def _block(
        self, ip: str, score: int, reasons: list[str], path: str, action: str
    ) -> None:
        self.blocker.ban(ip, ",".join(reasons))
        self.state.blocked_count += 1
        self.quarantine.isolate(
            ip=ip,
            path=path,
            reasons=reasons,
            score=score,
            action=action,
        )
        event = {
            "ip": ip,
            "score": score,
            "reasons": reasons,
            "path": path,
            "action": action,
            "timestamp": time.time(),
        }
        self.state.last_event = event
        with self.blocked_log.open("a", encoding="utf-8") as f:
            f.write(json.dumps(event) + "\n")
        await self.hub.notify(
            SecurityAlert(
                level="block",
                message=f"Blocked {ip}: {', '.join(reasons)}",
                ip=ip,
                action=action,
            )
        )

    def release_quarantine(self, entry_id: str) -> dict[str, Any]:
        return self.quarantine.release(entry_id)

    def self_heal_rules(self) -> dict[str, Any]:
        return self.rule_generator.maybe_generate_from_quarantine()

    def register_voice_fingerprint(
        self,
        *,
        phone_number: str,
        voice_hash: str,
        caller_label: str = "",
    ) -> dict[str, Any]:
        return self.voice_harassment.register(
            phone_number=phone_number,
            voice_hash=voice_hash,
            caller_label=caller_label,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "enabled": self.settings.enabled,
            "mode": self.settings.mode,
            "blocked_count": self.state.blocked_count,
            "learned_count": self.state.learned_count,
            "allowed_count": self.state.allowed_count,
            "active_bans": len(self.blocker.list_bans()),
            "last_event": self.state.last_event,
            "quarantine": self.quarantine.status(),
            "voice_harassment": self.voice_harassment.status(),
            "rule_generator": self.rule_generator.status(),
        }