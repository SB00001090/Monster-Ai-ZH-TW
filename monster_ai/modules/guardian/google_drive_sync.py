"""Google Drive API mirror for E2E encrypted Guardian sync bundles."""
from __future__ import annotations

import json
from typing import Any

import httpx

DRIVE_API = "https://www.googleapis.com/drive/v3"
FOLDER_MIME = "application/vnd.google-apps.folder"
JSON_MIME = "application/json"


class GoogleDriveSyncError(Exception):
    """Drive API failure."""


class GoogleDriveSyncClient:
    """Minimal Drive v3 client — stores encrypted JSON blobs only."""

    def __init__(self, access_token: str, *, folder_name: str = "Guardian Ai Sync") -> None:
        token = access_token.strip()
        if not token:
            raise GoogleDriveSyncError("access_token_required")
        self.access_token = token
        self.folder_name = folder_name
        self._folder_cache: dict[str, str] = {}

    def _headers(self, *, json_body: bool = False) -> dict[str, str]:
        headers = {"Authorization": f"Bearer {self.access_token}"}
        if json_body:
            headers["Content-Type"] = "application/json"
        return headers

    def _request(
        self,
        method: str,
        url: str,
        *,
        params: dict[str, Any] | None = None,
        json_body: dict[str, Any] | None = None,
        content: bytes | None = None,
        headers: dict[str, str] | None = None,
    ) -> httpx.Response:
        hdrs = self._headers(json_body=json_body is not None)
        if headers:
            hdrs.update(headers)
        with httpx.Client(timeout=30.0) as client:
            resp = client.request(
                method,
                url,
                params=params,
                json=json_body,
                content=content,
                headers=hdrs,
            )
        if resp.status_code >= 400:
            detail = resp.text[:300]
            raise GoogleDriveSyncError(f"drive_http_{resp.status_code}: {detail}")
        return resp

    def _find_child(self, parent_id: str, name: str, mime_type: str | None = None) -> str | None:
        q_parts = [
            f"name = '{name.replace(chr(39), chr(92) + chr(39))}'",
            f"'{parent_id}' in parents",
            "trashed = false",
        ]
        if mime_type:
            q_parts.append(f"mimeType = '{mime_type}'")
        params = {
            "q": " and ".join(q_parts),
            "fields": "files(id,name)",
            "pageSize": 1,
            "supportsAllDrives": "true",
            "includeItemsFromAllDrives": "true",
        }
        resp = self._request("GET", f"{DRIVE_API}/files", params=params)
        files = resp.json().get("files", [])
        return files[0]["id"] if files else None

    def _create_folder(self, parent_id: str, name: str) -> str:
        body = {
            "name": name,
            "mimeType": FOLDER_MIME,
            "parents": [parent_id],
        }
        resp = self._request(
            "POST",
            f"{DRIVE_API}/files",
            params={"fields": "id"},
            json_body=body,
        )
        return resp.json()["id"]

    def _ensure_folder(self, parent_id: str, name: str) -> str:
        cache_key = f"{parent_id}/{name}"
        if cache_key in self._folder_cache:
            return self._folder_cache[cache_key]
        found = self._find_child(parent_id, name, FOLDER_MIME)
        folder_id = found or self._create_folder(parent_id, name)
        self._folder_cache[cache_key] = folder_id
        return folder_id

    def _user_folder_id(self, provider: str, user_hash: str) -> str:
        root = self._ensure_folder("root", self.folder_name)
        provider_id = self._ensure_folder(root, provider)
        return self._ensure_folder(provider_id, user_hash)

    def upload_text(
        self,
        *,
        provider: str,
        user_hash: str,
        filename: str,
        text: str,
    ) -> dict[str, Any]:
        parent_id = self._user_folder_id(provider, user_hash)
        existing = self._find_child(parent_id, filename)
        metadata = {"name": filename, "mimeType": JSON_MIME}
        if existing:
            metadata.pop("parents", None)
            boundary = "guardian_sync_boundary"
            body = (
                f"--{boundary}\r\n"
                "Content-Type: application/json; charset=UTF-8\r\n\r\n"
                f"{json.dumps(metadata)}\r\n"
                f"--{boundary}\r\n"
                "Content-Type: application/json; charset=UTF-8\r\n\r\n"
                f"{text}\r\n"
                f"--{boundary}--"
            ).encode("utf-8")
            resp = self._request(
                "PATCH",
                f"https://www.googleapis.com/upload/drive/v3/files/{existing}",
                params={"uploadType": "multipart", "fields": "id,name,modifiedTime"},
                content=body,
                headers={"Content-Type": f"multipart/related; boundary={boundary}"},
            )
        else:
            metadata["parents"] = [parent_id]
            boundary = "guardian_sync_boundary"
            body = (
                f"--{boundary}\r\n"
                "Content-Type: application/json; charset=UTF-8\r\n\r\n"
                f"{json.dumps(metadata)}\r\n"
                f"--{boundary}\r\n"
                "Content-Type: application/json; charset=UTF-8\r\n\r\n"
                f"{text}\r\n"
                f"--{boundary}--"
            ).encode("utf-8")
            resp = self._request(
                "POST",
                "https://www.googleapis.com/upload/drive/v3/files",
                params={"uploadType": "multipart", "fields": "id,name,modifiedTime"},
                content=body,
                headers={"Content-Type": f"multipart/related; boundary={boundary}"},
            )
        data = resp.json()
        return {"file_id": data.get("id"), "name": data.get("name"), "modified": data.get("modifiedTime")}

    def download_text(self, *, provider: str, user_hash: str, filename: str) -> str | None:
        parent_id = self._user_folder_id(provider, user_hash)
        file_id = self._find_child(parent_id, filename)
        if not file_id:
            return None
        resp = self._request("GET", f"{DRIVE_API}/files/{file_id}", params={"alt": "media"})
        return resp.text