"""Ed25519 digital signatures for critical MonsterLock files."""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)
from cryptography.hazmat.primitives import serialization
from cryptography.exceptions import InvalidSignature

from monster_ai.protection.monsterlock.integrity import sha256_file
from monster_ai.protection.monsterlock.key_vault import dpapi_protect, dpapi_unprotect


@dataclass
class SignatureStore:
    data_dir: Path
    _private_key: Ed25519PrivateKey | None = None
    _public_key: Ed25519PublicKey | None = None

    @property
    def sealed_key_path(self) -> Path:
        return self.data_dir / "signing_key.sealed"

    @property
    def pubkey_path(self) -> Path:
        return self.data_dir / "signing_key.pub"

    def _load_or_create_keys(self) -> Ed25519PrivateKey:
        if self._private_key:
            return self._private_key
        self.data_dir.mkdir(parents=True, exist_ok=True)
        if self.sealed_key_path.exists():
            sealed = self.sealed_key_path.read_bytes()
            raw = dpapi_unprotect(sealed)
            if raw:
                self._private_key = Ed25519PrivateKey.from_private_bytes(raw)
                self._public_key = self._private_key.public_key()
                return self._private_key
        self._private_key = Ed25519PrivateKey.generate()
        self._public_key = self._private_key.public_key()
        priv_bytes = self._private_key.private_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PrivateFormat.Raw,
            encryption_algorithm=serialization.NoEncryption(),
        )
        sealed = dpapi_protect(priv_bytes, local_machine=True)
        if sealed:
            self.sealed_key_path.write_bytes(sealed)
        self.pubkey_path.write_bytes(
            self._public_key.public_bytes(
                encoding=serialization.Encoding.Raw,
                format=serialization.PublicFormat.Raw,
            )
        )
        return self._private_key

    def sign_file(self, root: Path, rel_path: str) -> dict[str, Any]:
        full = root / rel_path
        digest = sha256_file(full)
        priv = self._load_or_create_keys()
        sig = priv.sign(f"{rel_path}:{digest}".encode("utf-8")).hex()
        return {"path": rel_path, "sha256": digest, "signature_ed25519": sig}

    def verify_file(self, root: Path, entry: dict[str, Any]) -> bool:
        rel = entry.get("path", "")
        expected_digest = entry.get("sha256", "")
        sig_hex = entry.get("signature_ed25519", "")
        if not rel or not sig_hex:
            return False
        full = root / rel
        if not full.is_file():
            return False
        if sha256_file(full) != expected_digest:
            return False
        if not self.pubkey_path.exists():
            return True
        pub_bytes = self.pubkey_path.read_bytes()
        pub = Ed25519PublicKey.from_public_bytes(pub_bytes)
        try:
            pub.verify(bytes.fromhex(sig_hex), f"{rel}:{expected_digest}".encode("utf-8"))
            return True
        except InvalidSignature:
            return False

    def build_signed_manifest(self, root: Path, paths: list[str]) -> dict[str, Any]:
        entries = [self.sign_file(root, p.replace("\\", "/")) for p in sorted(paths)]
        return {"version": "2.0", "algorithm": "ed25519", "entries": entries}

    def verify_manifest(self, root: Path, manifest: dict[str, Any]) -> tuple[bool, list[str]]:
        bad: list[str] = []
        for entry in manifest.get("entries", []):
            if not self.verify_file(root, entry):
                bad.append(entry.get("path", "?"))
        return (len(bad) == 0, bad)