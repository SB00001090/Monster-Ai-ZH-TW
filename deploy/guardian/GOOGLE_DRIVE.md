# Guardian Ai × Google Drive API

Developed by Suckbob | Guardian Ai

Guardian sync bundles stay **E2E encrypted** before upload. Google Drive stores only ciphertext JSON — same as local `data/guardian/cloud/`.

Supabase remains optional for profiles/metadata; **Drive is the recommended blob mirror** for cross-device restore.

## 1. Enable Google Drive API

1. [Google Cloud Console](https://console.cloud.google.com/) → create/select project
2. **APIs & Services → Library** → enable **Google Drive API**
3. **Credentials → Create OAuth client ID** → Web application
4. Authorized redirect URIs (add all you use):
   ```
   http://localhost:3000/api/oauth/callback
   http://127.0.0.1:3000/api/oauth/callback
   https://monster-ai.pages.dev/api/oauth/callback
   ```

## 2. Environment

```env
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
VITE_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
```

## 3. OAuth scope

When signing in with Google, request:

```
https://www.googleapis.com/auth/drive.file
```

This limits access to files created by Guardian Ai in folder **`Guardian Ai Sync`**.

## 4. Backend config (`config.yaml`)

```yaml
guardian:
  cloud_sync_backend: dual   # local | google_drive | dual
  google_drive_folder_name: "Guardian Ai Sync"
```

| Mode | Behavior |
|------|----------|
| `local` | Disk only (default dev) |
| `dual` | Local cache + Drive mirror when token sent |
| `google_drive` | Drive required; pass `google_access_token` on every sync call |

## 5. API usage

```http
POST /api/guardian/sync/upload
{
  "provider": "google",
  "provider_sub": "<oauth-sub>",
  "passphrase": "my-secret-key-12",
  "bundle_type": "oc_cards",
  "payload": { "characters": [] },
  "google_access_token": "<drive-scoped-access-token>"
}
```

Download/list accept the same optional `google_access_token` (query param on `GET /sync/list`).

## 6. Verify

1. `GET /api/integrations/status` → `google_drive_configured: true`
2. `GET /api/guardian/status` → `cloud_sync_backend: "dual"`
3. Upload with token → response `storage: "dual"` or `"google_drive"`
4. Check Google Drive → folder **Guardian Ai Sync** → `google/<user_hash>/`

## Drive folder layout

```
Guardian Ai Sync/
  google/
    <user_hash>/
      oc_cards.json      (encrypted)
      manifest.json
  github/
    <user_hash>/
      ...
```