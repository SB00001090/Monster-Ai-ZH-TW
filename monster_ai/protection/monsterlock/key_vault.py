"""Runtime key vault — hardware + DPAPI, keys never persisted in plaintext."""
from __future__ import annotations

import ctypes
import logging
import secrets
import sys
from dataclasses import dataclass
from pathlib import Path

from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes

from monster_ai.protection.monsterlock.crypto import derive_key, wipe_bytes

logger = logging.getLogger(__name__)

CRYPTPROTECT_LOCAL_MACHINE = 0x4
CRYPTPROTECT_UI_FORBIDDEN = 0x1


class _DATA_BLOB(ctypes.Structure):
    _fields_ = [("cbData", ctypes.c_uint32), ("pbData", ctypes.POINTER(ctypes.c_char))]


def _bytes_to_blob(data: bytes) -> _DATA_BLOB:
    buf = ctypes.create_string_buffer(data, len(data))
    blob = _DATA_BLOB()
    blob.cbData = len(data)
    blob.pbData = buf
    return blob


def _blob_to_bytes(blob: _DATA_BLOB) -> bytes:
    if not blob.pbData or blob.cbData == 0:
        return b""
    return ctypes.string_at(blob.pbData, blob.cbData)


def dpapi_protect(data: bytes, *, local_machine: bool = True) -> bytes | None:
    if sys.platform != "win32":
        return None
    try:
        crypt32 = ctypes.windll.crypt32  # type: ignore[attr-defined]
        kernel32 = ctypes.windll.kernel32  # type: ignore[attr-defined]
        inp = _bytes_to_blob(data)
        out = _DATA_BLOB()
        flags = CRYPTPROTECT_UI_FORBIDDEN
        if local_machine:
            flags |= CRYPTPROTECT_LOCAL_MACHINE
        if not crypt32.CryptProtectData(
            ctypes.byref(inp), None, None, None, None, flags, ctypes.byref(out)
        ):
            return None
        result = _blob_to_bytes(out)
        kernel32.LocalFree(out.pbData)
        return result
    except Exception as exc:  # noqa: BLE001
        logger.debug("DPAPI protect failed: %s", exc)
        return None


def dpapi_unprotect(data: bytes) -> bytes | None:
    if sys.platform != "win32":
        return None
    try:
        crypt32 = ctypes.windll.crypt32  # type: ignore[attr-defined]
        kernel32 = ctypes.windll.kernel32  # type: ignore[attr-defined]
        inp = _bytes_to_blob(data)
        out = _DATA_BLOB()
        if not crypt32.CryptUnprotectData(
            ctypes.byref(inp), None, None, None, None, CRYPTPROTECT_UI_FORBIDDEN, ctypes.byref(out)
        ):
            return None
        result = _blob_to_bytes(out)
        kernel32.LocalFree(out.pbData)
        return result
    except Exception as exc:  # noqa: BLE001
        logger.debug("DPAPI unprotect failed: %s", exc)
        return None


@dataclass
class RuntimeKeyVault:
    """Derives master keys at runtime; sealed entropy uses DPAPI (machine-bound)."""

    fingerprint: str
    data_dir: Path
    _master_key: bytes | None = None
    _session_key: bytes | None = None
    _sealed_path: Path | None = None

    def __post_init__(self) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self._sealed_path = self.data_dir / "sealed_entropy.bin"

    def _load_or_create_entropy(self) -> bytes:
        if self._sealed_path and self._sealed_path.exists():
            sealed = self._sealed_path.read_bytes()
            unwrapped = dpapi_unprotect(sealed)
            if unwrapped:
                return unwrapped
            logger.warning("DPAPI unwrap failed — re-sealing entropy")
        entropy = secrets.token_bytes(32)
        sealed = dpapi_protect(entropy, local_machine=True)
        if sealed and self._sealed_path:
            self._sealed_path.write_bytes(sealed)
        else:
            logger.warning("DPAPI unavailable — using hardware-only key layer")
        return entropy

    def derive_master_key(self) -> bytes:
        if self._master_key:
            return self._master_key
        entropy = self._load_or_create_entropy()
        hw = derive_key(self.fingerprint, info=b"monsterlock-master-v2")
        try:
            hkdf = HKDF(
                algorithm=hashes.SHA256(),
                length=32,
                salt=entropy,
                info=b"monsterlock-master-combined",
            )
            self._master_key = hkdf.derive(hw.key)
        finally:
            hw.wipe()
            wipe_bytes(entropy)
        return self._master_key

    def rotate_session_key(self) -> bytes:
        master = self.derive_master_key()
        nonce = secrets.token_bytes(16)
        hkdf = HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=nonce,
            info=b"monsterlock-session",
        )
        if self._session_key:
            wipe_bytes(self._session_key)
        self._session_key = hkdf.derive(master)
        return self._session_key

    @property
    def session_key(self) -> bytes:
        if not self._session_key:
            return self.rotate_session_key()
        return self._session_key

    def wipe_all(self) -> None:
        if self._master_key:
            wipe_bytes(self._master_key)
            self._master_key = None
        if self._session_key:
            wipe_bytes(self._session_key)
            self._session_key = None