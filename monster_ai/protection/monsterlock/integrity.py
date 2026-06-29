"""File integrity manifest, signature verification, and self-repair."""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import shutil
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class IntegrityEntry:
    path: str
    sha256: str
    size: int
    signature: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "path": self.path,
            "sha256": self.sha256,
            "size": self.size,
            "signature": self.signature,
        }


@dataclass
class IntegrityReport:
    ok: bool
    tampered: list[str] = field(default_factory=list)
    missing: list[str] = field(default_factory=list)
    repaired: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "tampered": self.tampered,
            "missing": self.missing,
            "repaired": self.repaired,
            "errors": self.errors,
        }


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def sign_entry(path: str, digest: str, signing_key: bytes) -> str:
    msg = f"{path}:{digest}".encode("utf-8")
    return hmac.new(signing_key, msg, hashlib.sha256).hexdigest()


def build_manifest(
    root: Path,
    paths: list[str],
    signing_key: bytes,
    *,
    version: str = "1.0",
) -> dict[str, Any]:
    entries: list[dict[str, Any]] = []
    for rel in sorted(paths):
        full = (root / rel).resolve()
        if not full.is_file():
            continue
        digest = sha256_file(full)
        sig = sign_entry(rel.replace("\\", "/"), digest, signing_key)
        entries.append(
            IntegrityEntry(
                path=rel.replace("\\", "/"),
                sha256=digest,
                size=full.stat().st_size,
                signature=sig,
            ).to_dict()
        )
    return {
        "version": version,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "entries": entries,
    }


def load_manifest(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"version": "0", "entries": []}
    return json.loads(path.read_text(encoding="utf-8"))


def save_manifest(path: Path, manifest: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def verify_manifest(
    root: Path,
    manifest: dict[str, Any],
    signing_key: bytes,
) -> IntegrityReport:
    report = IntegrityReport(ok=True)
    for entry in manifest.get("entries", []):
        rel = entry.get("path", "")
        expected = entry.get("sha256", "")
        sig = entry.get("signature", "")
        full = root / rel
        if not full.is_file():
            report.missing.append(rel)
            report.ok = False
            continue
        actual = sha256_file(full)
        if actual != expected:
            report.tampered.append(rel)
            report.ok = False
        expected_sig = sign_entry(rel, expected, signing_key)
        if sig and not hmac.compare_digest(sig, expected_sig):
            report.tampered.append(f"{rel} (bad signature)")
            report.ok = False
    return report


def repair_from_backup(
    root: Path,
    rel_paths: list[str],
    backup_dir: Path,
) -> IntegrityReport:
    report = IntegrityReport(ok=True)
    for rel in rel_paths:
        src = backup_dir / rel
        dst = root / rel
        if not src.is_file():
            report.errors.append(f"no backup for {rel}")
            report.ok = False
            continue
        try:
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
            report.repaired.append(rel)
            logger.info("MonsterLock repaired %s from backup", rel)
        except OSError as exc:
            report.errors.append(f"{rel}: {exc}")
            report.ok = False
    return report


DEFAULT_PROTECTED_PATHS = [
    "monster_ai/protection/monsterlock/engine.py",
    "monster_ai/protection/monsterlock/crypto.py",
    "monster_ai/protection/monsterlock/hardware.py",
    "monster_ai/protection/monsterlock/integrity.py",
    "monster_ai/protection/monsterlock/anti_debug.py",
    "monster_ai/protection/firewall.py",
    "config.yaml",
]