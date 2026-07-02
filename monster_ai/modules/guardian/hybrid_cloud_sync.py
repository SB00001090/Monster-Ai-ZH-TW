"""Local + optional Google Drive cloud sync backends."""
from __future__ import annotations

import json
from typing import Any

from monster_ai.modules.guardian.cloud_sync import CloudSyncStore
from monster_ai.modules.guardian.google_drive_sync import GoogleDriveSyncClient, GoogleDriveSyncError


class HybridCloudSyncStore:
    """Local encrypted cache with optional Google Drive mirror."""

    def __init__(
        self,
        local: CloudSyncStore,
        *,
        backend: str = "dual",
        folder_name: str = "Guardian Ai Sync",
    ) -> None:
        self.local = local
        self.backend = backend if backend in {"local", "google_drive", "dual"} else "dual"
        self.folder_name = folder_name

    def _drive_client(self, access_token: str | None) -> GoogleDriveSyncClient | None:
        if not access_token:
            return None
        return GoogleDriveSyncClient(access_token, folder_name=self.folder_name)

    def _mirror_upload(
        self,
        *,
        provider: str,
        provider_sub: str,
        access_token: str,
        bundle_type: str,
    ) -> dict[str, Any]:
        from monster_ai.modules.guardian.crypto import oauth_user_hash

        user_hash = oauth_user_hash(provider, provider_sub)
        user_dir = self.local._user_dir(provider, provider_sub)
        bundle_path = user_dir / f"{bundle_type}.json"
        manifest_path = user_dir / "manifest.json"
        client = self._drive_client(access_token)
        if not client or not bundle_path.is_file():
            return {"mirrored": False, "backend": "google_drive", "error": "missing_local_bundle"}
        try:
            client.upload_text(
                provider=provider,
                user_hash=user_hash,
                filename=f"{bundle_type}.json",
                text=bundle_path.read_text(encoding="utf-8"),
            )
            if manifest_path.is_file():
                client.upload_text(
                    provider=provider,
                    user_hash=user_hash,
                    filename="manifest.json",
                    text=manifest_path.read_text(encoding="utf-8"),
                )
            return {"mirrored": True, "backend": "google_drive"}
        except GoogleDriveSyncError as exc:
            return {"mirrored": False, "backend": "google_drive", "error": str(exc)}

    def upload_bundle(
        self,
        *,
        provider: str,
        provider_sub: str,
        passphrase: str,
        bundle_type: str,
        payload: dict[str, Any] | list[Any],
        device_id: str = "unknown",
        google_access_token: str | None = None,
    ) -> dict[str, Any]:
        if self.backend in {"google_drive", "dual"} and not google_access_token:
            if self.backend == "google_drive":
                return {"ok": False, "reason": "google_access_token_required"}

        result = self.local.upload_bundle(
            provider=provider,
            provider_sub=provider_sub,
            passphrase=passphrase,
            bundle_type=bundle_type,
            payload=payload,
            device_id=device_id,
        )
        if not result.get("ok"):
            return result

        if self.backend == "local":
            result["storage"] = "local"
            return result

        if not google_access_token:
            result["storage"] = "local"
            return result

        mirror = self._mirror_upload(
            provider=provider,
            provider_sub=provider_sub,
            access_token=google_access_token,
            bundle_type=bundle_type,
        )

        if self.backend == "google_drive":
            if mirror.get("mirrored"):
                return {**result, "storage": "google_drive", "mirror": mirror}
            return {
                "ok": False,
                "reason": "google_drive_upload_failed",
                "detail": mirror.get("error", "unknown"),
            }

        result["mirror"] = mirror
        result["storage"] = "dual" if mirror.get("mirrored") else "local"
        return result

    def download_bundle(
        self,
        *,
        provider: str,
        provider_sub: str,
        passphrase: str,
        bundle_type: str,
        google_access_token: str | None = None,
    ) -> dict[str, Any]:
        from monster_ai.modules.guardian.crypto import (
            EncryptedBlob,
            decrypt_payload,
            derive_oauth_key,
            oauth_user_hash,
        )

        if self.backend == "google_drive" and not google_access_token:
            return {"ok": False, "reason": "google_access_token_required"}

        if self.backend in {"google_drive", "dual"} and google_access_token:
            user_hash = oauth_user_hash(provider, provider_sub)
            client = self._drive_client(google_access_token)
            if client:
                try:
                    raw = client.download_text(
                        provider=provider,
                        user_hash=user_hash,
                        filename=f"{bundle_type}.json",
                    )
                    if raw:
                        meta = json.loads(raw)
                        blob = EncryptedBlob.from_dict(meta["encrypted"])
                        import base64

                        salt = base64.b64decode(blob.salt_b64)
                        key = derive_oauth_key(provider, provider_sub, passphrase, salt)
                        payload = decrypt_payload(blob, key)
                        return {
                            "ok": True,
                            "bundle_type": bundle_type,
                            "uploaded_at": meta.get("uploaded_at"),
                            "payload": payload,
                            "storage": "google_drive",
                        }
                except (GoogleDriveSyncError, json.JSONDecodeError, Exception) as exc:  # noqa: BLE001
                    if self.backend == "google_drive":
                        return {"ok": False, "reason": "google_drive_download_failed", "detail": str(exc)}

        local = self.local.download_bundle(
            provider=provider,
            provider_sub=provider_sub,
            passphrase=passphrase,
            bundle_type=bundle_type,
        )
        if local.get("ok"):
            local["storage"] = "local" if self.backend == "local" else "dual_local"
        return local

    def list_bundles(
        self,
        provider: str,
        provider_sub: str,
        *,
        google_access_token: str | None = None,
    ) -> dict[str, Any]:
        local = self.local.list_bundles(provider, provider_sub)
        if self.backend == "local" or not google_access_token:
            local["storage"] = "local"
            return local

        from monster_ai.modules.guardian.crypto import oauth_user_hash

        user_hash = oauth_user_hash(provider, provider_sub)
        client = self._drive_client(google_access_token)
        if not client:
            return local
        try:
            raw = client.download_text(
                provider=provider,
                user_hash=user_hash,
                filename="manifest.json",
            )
            if raw:
                manifest = json.loads(raw)
                return {
                    "bundles": manifest.get("bundles", []),
                    "last_sync": manifest.get("last_sync"),
                    "user_hash": user_hash,
                    "storage": "google_drive",
                }
        except (GoogleDriveSyncError, json.JSONDecodeError):
            pass
        local["storage"] = "dual_local"
        return local