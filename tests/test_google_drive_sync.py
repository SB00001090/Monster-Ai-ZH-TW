"""Tests for Google Drive hybrid cloud sync."""
from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from monster_ai.modules.guardian.cloud_sync import CloudSyncStore
from monster_ai.modules.guardian.hybrid_cloud_sync import HybridCloudSyncStore


@pytest.fixture
def hybrid(tmp_path: Path) -> HybridCloudSyncStore:
    return HybridCloudSyncStore(
        CloudSyncStore(tmp_path),
        backend="dual",
        folder_name="Guardian Ai Sync",
    )


def test_dual_upload_without_token_stays_local(hybrid: HybridCloudSyncStore) -> None:
    payload = {"characters": [{"id": "c1"}]}
    result = hybrid.upload_bundle(
        provider="google",
        provider_sub="gid-1",
        passphrase="my-secret-key-12",
        bundle_type="oc_cards",
        payload=payload,
    )
    assert result["ok"] is True
    assert result.get("storage") == "local"


def test_google_drive_backend_requires_token(hybrid: HybridCloudSyncStore) -> None:
    hybrid.backend = "google_drive"
    result = hybrid.upload_bundle(
        provider="google",
        provider_sub="gid-1",
        passphrase="my-secret-key-12",
        bundle_type="oc_cards",
        payload={"x": 1},
    )
    assert result["ok"] is False
    assert result["reason"] == "google_access_token_required"


@patch("monster_ai.modules.guardian.hybrid_cloud_sync.GoogleDriveSyncClient")
def test_dual_upload_mirrors_to_drive(mock_cls: MagicMock, hybrid: HybridCloudSyncStore) -> None:
    client = MagicMock()
    client.upload_text.return_value = {"file_id": "f1"}
    mock_cls.return_value = client

    payload = {"characters": [{"id": "c1"}]}
    result = hybrid.upload_bundle(
        provider="google",
        provider_sub="gid-2",
        passphrase="my-secret-key-12",
        bundle_type="oc_cards",
        payload=payload,
        google_access_token="ya29.test-token",
    )
    assert result["ok"] is True
    assert result.get("storage") == "dual"
    assert client.upload_text.call_count >= 1


def test_roundtrip_local_unchanged(hybrid: HybridCloudSyncStore) -> None:
    payload = {"prefs": {"theme": "neon"}}
    hybrid.upload_bundle(
        provider="github",
        provider_sub="gh-1",
        passphrase="my-secret-key-12",
        bundle_type="preferences",
        payload=payload,
    )
    down = hybrid.download_bundle(
        provider="github",
        provider_sub="gh-1",
        passphrase="my-secret-key-12",
        bundle_type="preferences",
    )
    assert down["ok"] is True
    assert down["payload"] == payload