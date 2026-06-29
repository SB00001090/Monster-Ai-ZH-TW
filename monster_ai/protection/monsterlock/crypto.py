"""AES-256-GCM encryption with hardware-derived keys."""
from __future__ import annotations

import os
import secrets
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes

MAGIC = b"MLCK\x02"  # MonsterLock encrypted file v2
NONCE_SIZE = 12
TAG_SIZE = 16
SALT_SIZE = 16


@dataclass
class DerivedKey:
    key: bytes
    salt: bytes
    fingerprint: str

    def wipe(self) -> None:
        if self.key:
            wipe_bytes(self.key)


def wipe_bytes(buf: bytes | bytearray) -> None:
    """Best-effort memory wipe (Python cannot guarantee zeroing)."""
    try:
        if isinstance(buf, bytearray):
            for i in range(len(buf)):
                buf[i] = 0
        else:
            mv = memoryview(buf)
            for i in range(len(mv)):
                mv[i] = 0
    except Exception:  # noqa: BLE001
        pass


STATIC_SALT = b"monsterlock-static-v2"


def derive_static_key(fingerprint: str, *, info: bytes = b"monsterlock-integrity") -> bytes:
    """Deterministic integrity key (stable across restarts)."""
    hkdf = HKDF(algorithm=hashes.SHA256(), length=32, salt=STATIC_SALT, info=info)
    return hkdf.derive(fingerprint.encode("utf-8"))


def derive_key(fingerprint: str, salt: bytes | None = None, *, info: bytes = b"monsterlock-v1") -> DerivedKey:
    """HKDF-SHA256 from hardware fingerprint → 256-bit AES key."""
    if salt is None:
        salt = secrets.token_bytes(SALT_SIZE)
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        info=info,
    )
    key = hkdf.derive(fingerprint.encode("utf-8"))
    return DerivedKey(key=key, salt=salt, fingerprint=fingerprint)


def encrypt_bytes(plaintext: bytes, fingerprint: str, *, aad: bytes = b"") -> bytes:
    dk = derive_key(fingerprint)
    try:
        nonce = secrets.token_bytes(NONCE_SIZE)
        aesgcm = AESGCM(dk.key)
        ciphertext = aesgcm.encrypt(nonce, plaintext, aad or None)
        return MAGIC + dk.salt + nonce + ciphertext
    finally:
        dk.wipe()


def decrypt_bytes(blob: bytes, fingerprint: str, *, aad: bytes = b"") -> bytes:
    if len(blob) < len(MAGIC) + SALT_SIZE + NONCE_SIZE + TAG_SIZE:
        raise ValueError("Invalid encrypted blob")
    if blob[: len(MAGIC)] != MAGIC:
        raise ValueError("Not a MonsterLock encrypted file")
    offset = len(MAGIC)
    salt = blob[offset : offset + SALT_SIZE]
    offset += SALT_SIZE
    nonce = blob[offset : offset + NONCE_SIZE]
    offset += NONCE_SIZE
    ciphertext = blob[offset:]
    dk = derive_key(fingerprint, salt=salt)
    try:
        aesgcm = AESGCM(dk.key)
        return aesgcm.decrypt(nonce, ciphertext, aad or None)
    finally:
        dk.wipe()


def encrypt_file(src: Path, dst: Path, fingerprint: str, *, aad: bytes = b"") -> None:
    plaintext = src.read_bytes()
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_bytes(encrypt_bytes(plaintext, fingerprint, aad=aad))


def decrypt_file(enc_path: Path, fingerprint: str, *, aad: bytes = b"") -> bytes:
    return decrypt_bytes(enc_path.read_bytes(), fingerprint, aad=aad)


def is_encrypted_file(path: Path) -> bool:
    try:
        with path.open("rb") as f:
            header = f.read(len(MAGIC))
        return header == MAGIC
    except OSError:
        return False


class SecureBuffer:
    """In-memory buffer that wipes on close."""

    def __init__(self, data: bytes) -> None:
        self._data = bytearray(data)

    def read(self) -> bytes:
        return bytes(self._data)

    def close(self) -> None:
        wipe_bytes(self._data)
        self._data = bytearray()

    def __enter__(self) -> "SecureBuffer":
        return self

    def __exit__(self, *args: object) -> None:
        self.close()


def stream_decrypt_to_memory(enc_path: Path, fingerprint: str) -> SecureBuffer:
    """Decrypt file entirely into protected memory buffer (no disk plaintext)."""
    data = decrypt_file(enc_path, fingerprint)
    return SecureBuffer(data)