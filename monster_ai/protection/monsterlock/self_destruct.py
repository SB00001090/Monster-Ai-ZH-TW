"""Force self-destruct — wipe keys and corrupt protected assets."""
from __future__ import annotations

import json
import logging
import os
import secrets
import sys
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

from monster_ai.protection.monsterlock.crypto import is_encrypted_file, wipe_bytes

logger = logging.getLogger(__name__)

CORRUPT_EXTENSIONS = {".safetensors", ".pt", ".bin", ".ckpt", ".mlck", ".mlck3", ".json", ".yaml"}
SKIP_CORRUPT_PREFIXES = ("monster_ai/", "scripts/")
SKIP_CORRUPT_FILES = frozenset({"config.yaml", "config.example.yaml"})


@dataclass
class DestructionReport:
    corrupted_files: list[str] = field(default_factory=list)
    deleted_files: list[str] = field(default_factory=list)
    keys_wiped: bool = False
    locked: bool = False
    reason: str = ""

    def to_dict(self) -> dict:
        return {
            "corrupted_files": self.corrupted_files,
            "deleted_files": self.deleted_files,
            "keys_wiped": self.keys_wiped,
            "locked": self.locked,
            "reason": self.reason,
        }


def _corrupt_file(path: Path) -> bool:
    try:
        size = path.stat().st_size
        if size == 0:
            path.write_bytes(secrets.token_bytes(256))
            return True
        with path.open("r+b") as f:
            # Destroy header magic (safetensors/tensor), scatter corruption
            f.seek(0)
            f.write(secrets.token_bytes(min(512, size)))
            for offset in (1024, 4096, 65536, size // 2):
                if offset < size:
                    f.seek(offset)
                    f.write(secrets.token_bytes(min(64, size - offset)))
        return True
    except OSError as exc:
        logger.warning("Corrupt failed %s: %s", path, exc)
        return False


def _wipe_sealed_keys(data_dir: Path) -> None:
    for name in ("sealed_entropy.bin", "signing_key.sealed", "hardware.binding", "config.seal"):
        p = data_dir / name
        if p.exists():
            try:
                p.write_bytes(secrets.token_bytes(p.stat().st_size or 64))
                p.unlink(missing_ok=True)
            except OSError:
                pass


def execute_self_destruct(
    root: Path,
    data_dir: Path,
    *,
    asset_paths: list[str],
    reason: str,
    key_vault_wipe: Callable[[], None] | None = None,
    corrupt_models: bool = True,
    exit_process: bool = False,
) -> DestructionReport:
    """Destroy keys and corrupt model assets so copies become unusable."""
    report = DestructionReport(reason=reason)
    data_dir.mkdir(parents=True, exist_ok=True)

    if key_vault_wipe:
        key_vault_wipe()
        report.keys_wiped = True

    _wipe_sealed_keys(data_dir)

    if corrupt_models:
        for rel in asset_paths:
            base = root / rel.lstrip("./")
            if base.is_file():
                targets = [base]
            elif base.is_dir():
                targets = [
                    p
                    for p in base.rglob("*")
                    if p.is_file() and p.suffix.lower() in CORRUPT_EXTENSIONS
                ]
            else:
                continue
            for fp in targets:
                rel = str(fp.relative_to(root)).replace("\\", "/")
                if rel in SKIP_CORRUPT_FILES:
                    continue
                if rel.startswith(SKIP_CORRUPT_PREFIXES) and fp.suffix.lower() == ".py":
                    continue
                if _corrupt_file(fp):
                    report.corrupted_files.append(rel)

    # Remove credential state
    cred = data_dir / "credentials.json"
    if cred.exists():
        cred.unlink()
        report.deleted_files.append(str(cred.relative_to(root)))

    lock_file = data_dir / "LOCKED"
    lock_file.write_text(
        json.dumps(
            {
                "locked_at": time.time(),
                "reason": reason,
                "corrupted_count": len(report.corrupted_files),
                "self_destruct": True,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    report.locked = True

    log = data_dir / "destruction.log"
    log.write_text(json.dumps(report.to_dict(), indent=2), encoding="utf-8")
    logger.critical("MonsterLock SELF-DESTRUCT: %s (%d files corrupted)", reason, len(report.corrupted_files))

    if exit_process:
        os._exit(3)  # noqa: SLF001 — immediate termination, no cleanup hooks
    return report