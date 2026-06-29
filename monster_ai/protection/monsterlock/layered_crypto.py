"""Layered AES-256-GCM with chunked streaming for large model files."""
from __future__ import annotations

import secrets
import struct
from pathlib import Path
from typing import Iterator

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes

from monster_ai.protection.monsterlock.crypto import MAGIC, NONCE_SIZE, SALT_SIZE, wipe_bytes

MAGIC_V3 = b"MLCK\x03"
DEFAULT_CHUNK = 1024 * 1024  # 1 MiB — good for RTX 4090 streaming


def _chunk_key(master_key: bytes, session_key: bytes, index: int) -> bytes:
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=struct.pack(">I", index),
        info=session_key + b"mlck-chunk-v3",
    )
    return hkdf.derive(master_key)


def encrypt_file_layered(
    src: Path,
    dst: Path,
    master_key: bytes,
    session_key: bytes,
    *,
    chunk_size: int = DEFAULT_CHUNK,
) -> None:
    salt_hw = secrets.token_bytes(SALT_SIZE)
    salt_sess = secrets.token_bytes(SALT_SIZE)
    plaintext = src.read_bytes()
    chunks: list[bytes] = []
    for i in range(0, len(plaintext), chunk_size):
        chunk = plaintext[i : i + chunk_size]
        key = _chunk_key(master_key, session_key, i // chunk_size)
        nonce = secrets.token_bytes(NONCE_SIZE)
        ct = AESGCM(key).encrypt(nonce, chunk, salt_hw + salt_sess)
        chunks.append(nonce + ct)
        wipe_bytes(key)

    num_chunks = len(chunks)
    body = b"".join(chunks)
    header = (
        MAGIC_V3
        + salt_hw
        + salt_sess
        + struct.pack(">II", chunk_size, num_chunks)
    )
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_bytes(header + body)


def _parse_header(blob: bytes) -> tuple[bytes, bytes, int, int, int]:
    offset = len(MAGIC_V3)
    salt_hw = blob[offset : offset + SALT_SIZE]
    offset += SALT_SIZE
    salt_sess = blob[offset : offset + SALT_SIZE]
    offset += SALT_SIZE
    chunk_size, num_chunks = struct.unpack(">II", blob[offset : offset + 8])
    offset += 8
    return salt_hw, salt_sess, chunk_size, num_chunks, offset


def decrypt_file_layered(
    enc_path: Path,
    master_key: bytes,
    session_key: bytes,
) -> bytes:
    blob = enc_path.read_bytes()
    if not blob.startswith(MAGIC_V3):
        raise ValueError("Not a layered MonsterLock file (v3)")
    salt_hw, salt_sess, chunk_size, num_chunks, offset = _parse_header(blob)
    parts: list[bytes] = []
    for idx in range(num_chunks):
        nonce = blob[offset : offset + NONCE_SIZE]
        offset += NONCE_SIZE
        end = offset + chunk_size + 16  # approx; GCM tag embedded in ciphertext
        if idx == num_chunks - 1:
            ct = blob[offset:]
        else:
            ct = blob[offset : offset + chunk_size + 16]
            offset += len(ct)
        key = _chunk_key(master_key, session_key, idx)
        try:
            plain = AESGCM(key).decrypt(nonce, ct, salt_hw + salt_sess)
            parts.append(plain)
        finally:
            wipe_bytes(key)
    return b"".join(parts)


def stream_decrypt_chunks(
    enc_path: Path,
    master_key: bytes,
    session_key: bytes,
) -> Iterator[bytes]:
    """Yield decrypted chunks for memory-efficient model loading."""
    blob = enc_path.read_bytes()
    if not blob.startswith(MAGIC_V3):
        raise ValueError("Not a layered MonsterLock file (v3)")
    salt_hw, salt_sess, chunk_size, num_chunks, offset = _parse_header(blob)
    for idx in range(num_chunks):
        nonce = blob[offset : offset + NONCE_SIZE]
        offset += NONCE_SIZE
        if idx == num_chunks - 1:
            ct = blob[offset:]
        else:
            ct = blob[offset : offset + chunk_size + 16]
            offset += len(ct)
        key = _chunk_key(master_key, session_key, idx)
        try:
            yield AESGCM(key).decrypt(nonce, ct, salt_hw + salt_sess)
        finally:
            wipe_bytes(key)


def is_layered_file(path: Path) -> bool:
    try:
        with path.open("rb") as f:
            return f.read(len(MAGIC_V3)) == MAGIC_V3
    except OSError:
        return False