"""URL normalization and blacklist scanning."""
from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import urlparse

from monster_ai.modules.discord.guard.threat import ThreatResult

_SUSPICIOUS_TLDS = {".xyz", ".top", ".click", ".gq", ".tk", ".ml", ".cf", ".ga", ".buzz", ".icu"}
_DISCORD_LOOKALIKE = re.compile(r"disc[o0]rd|dlscord|discord[\s.-]?app|discord[\s.-]?gift", re.I)
_HOMOGLYPH_O = re.compile(r"[\u043e\u03bf]")  # Cyrillic/Greek o


class UrlScanner:
    def __init__(self, blacklist_path: Path | None = None) -> None:
        self._domains: set[str] = set()
        if blacklist_path and blacklist_path.exists():
            for line in blacklist_path.read_text(encoding="utf-8").splitlines():
                line = line.strip().lower()
                if line and not line.startswith("#"):
                    self._domains.add(line)

    def add_domain(self, domain: str) -> None:
        self._domains.add(domain.lower().strip())

    def _normalize_host(self, url: str) -> str:
        try:
            parsed = urlparse(url if "://" in url else f"http://{url}")
            return (parsed.hostname or "").lower()
        except Exception:  # noqa: BLE001
            return ""

    async def scan(self, urls: list[str]) -> ThreatResult:
        result = ThreatResult()
        for url in urls:
            host = self._normalize_host(url)
            if not host:
                continue

            if host in self._domains:
                result.merge(
                    ThreatResult(
                        score=80,
                        reasons=[f"blacklist:{host}"],
                        scam_type="phishing",
                        recommended_action="delete",
                    )
                )
                continue

            if _DISCORD_LOOKALIKE.search(host) and "discord.com" not in host and "discord.gg" not in host:
                result.merge(
                    ThreatResult(
                        score=55,
                        reasons=[f"lookalike_domain:{host}"],
                        scam_type="nitro",
                    )
                )

            if _HOMOGLYPH_O.search(host):
                result.merge(
                    ThreatResult(score=60, reasons=[f"homoglyph_domain:{host}"], scam_type="phishing")
                )

            tld = "." + host.rsplit(".", 1)[-1] if "." in host else ""
            if tld in _SUSPICIOUS_TLDS and _DISCORD_LOOKALIKE.search(url):
                result.merge(
                    ThreatResult(score=40, reasons=[f"suspicious_tld:{tld}"], scam_type="phishing")
                )

        return result