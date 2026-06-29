"""Runtime secure vault — layered decrypt, memory-only."""
from __future__ import annotations

import json
import logging
import tempfile
from pathlib import Path
from typing import Any

from monster_ai.protection.monsterlock.crypto import (
    SecureBuffer,
    decrypt_bytes,
    decrypt_file,
    is_encrypted_file,
    stream_decrypt_to_memory,
)
from monster_ai.protection.monsterlock.key_vault import RuntimeKeyVault
from monster_ai.protection.monsterlock.layered_crypto import (
    decrypt_file_layered,
    is_layered_file,
    stream_decrypt_chunks,
)

logger = logging.getLogger(__name__)


class SecureVault:
    def __init__(
        self,
        fingerprint: str,
        vault_dir: Path,
        *,
        key_vault: RuntimeKeyVault | None = None,
    ) -> None:
        self.fingerprint = fingerprint
        self.vault_dir = vault_dir
        self.vault_dir.mkdir(parents=True, exist_ok=True)
        self._key_vault = key_vault
        self._cache: dict[str, SecureBuffer] = {}

    def _master_and_session(self) -> tuple[bytes, bytes]:
        if self._key_vault:
            return self._key_vault.derive_master_key(), self._key_vault.session_key
        raise RuntimeError("Key vault required for layered decryption")

    def read_bytes(self, enc_path: Path) -> bytes:
        key = str(enc_path.resolve())
        if key in self._cache:
            return self._cache[key].read()

        if is_layered_file(enc_path):
            master, session = self._master_and_session()
            data = decrypt_file_layered(enc_path, master, session)
            buf = SecureBuffer(data)
            self._cache[key] = buf
            return buf.read()

        if is_encrypted_file(enc_path):
            buf = stream_decrypt_to_memory(enc_path, self.fingerprint)
            self._cache[key] = buf
            return buf.read()

        return enc_path.read_bytes()

    def read_text(self, enc_path: Path, *, encoding: str = "utf-8") -> str:
        return self.read_bytes(enc_path).decode(encoding)

    def read_json(self, enc_path: Path) -> Any:
        return json.loads(self.read_text(enc_path))

    def load_workflow(self, workflow_path: Path) -> dict[str, Any]:
        if workflow_path.suffix in {".mlck", ".mlck3"} or is_encrypted_file(workflow_path) or is_layered_file(workflow_path):
            return self.read_json(workflow_path)
        if workflow_path.exists():
            return json.loads(workflow_path.read_text(encoding="utf-8"))
        raise FileNotFoundError(workflow_path)

    def stream_model_chunks(self, enc_path: Path):
        """Stream large model for RTX 4090 without full-RAM load."""
        if is_layered_file(enc_path):
            master, session = self._master_and_session()
            yield from stream_decrypt_chunks(enc_path, master, session)
        else:
            yield self.read_bytes(enc_path)

    def materialize_lora_temp(self, enc_lora: Path) -> Path:
        suffix = ".safetensors" if "safetensors" in enc_lora.name else ".pt"
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix, prefix="mlck_")
        if is_layered_file(enc_lora):
            for chunk in self.stream_model_chunks(enc_lora):
                tmp.write(chunk)
        else:
            tmp.write(self.read_bytes(enc_lora))
        tmp.close()
        return Path(tmp.name)

    def wipe(self) -> None:
        for buf in self._cache.values():
            buf.close()
        self._cache.clear()