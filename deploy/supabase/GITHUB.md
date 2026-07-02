# Supabase × GitHub

Guardian Ai repo: **SB00001090/Guardian-Ai**  
Supabase org: [htczqqftnoubcyfrehmq](https://supabase.com/dashboard/org/htczqqftnoubcyfrehmq)  
Region: **ap-southeast-2** (Sydney)

There are two separate GitHub connections:

| Type | Purpose |
|------|---------|
| **GitHub Integration** | Auto-deploy SQL migrations from this repo |
| **GitHub OAuth** | Let users sign in with GitHub via Supabase Auth |

---

## A. GitHub Integration (migrations)

Connects your Supabase project to the Guardian-Ai repository so pushes to `main` apply migrations under `deploy/supabase/migrations/`.

### Dashboard steps

1. Open your project → **Project Settings** → [**Integrations**](https://supabase.com/dashboard/project/_/settings/integrations).
2. Under **GitHub Integration**, click **Authorize GitHub**.
3. On GitHub, click **Authorize Supabase**.
4. Select repository: **`SB00001090/Guardian-Ai`**.
5. **Working directory:** `deploy`  
   (because `supabase/` lives at `deploy/supabase/`, not repo root)
6. Recommended options:
   - **Deploy to production** — ON (apply migrations on merge to `main`)
   - **Automatic branching** — optional (preview DB per PR)
7. Click **Enable integration**.

### GitHub branch protection (recommended)

In [Guardian-Ai repo settings](https://github.com/SB00001090/Guardian-Ai/settings/branches), add a required check for **Supabase** so failed migrations cannot merge.

### What gets deployed

Only files under `deploy/supabase/migrations/` are applied to production.  
`config.toml` is used for preview branches; Auth/API dashboard settings are not overwritten on production deploy.

### First deploy

If you already ran `guardian_schema.sql` manually in SQL Editor, the first GitHub migration may conflict. Either:

- Skip manual SQL and let the integration run `20260702120000_guardian_schema.sql`, or
- Mark the migration as applied in Supabase before enabling deploy.

---

## B. GitHub OAuth (login)

Use this if Guardian users should sign in through Supabase Auth with GitHub (parallel to existing Node OAuth).

### 1. Create GitHub OAuth App

[GitHub → Developer settings → OAuth Apps → New](https://github.com/settings/applications/new)

| Field | Value |
|-------|-------|
| Application name | `Guardian Ai` |
| Homepage URL | `https://monster-ai.pages.dev` (or `http://localhost:3000` for dev) |
| Authorization callback URL | `https://<PROJECT_REF>.supabase.co/auth/v1/callback` |

Copy **Client ID** and generate **Client secret**.

### 2. Supabase Auth provider

Project → **Authentication** → **Providers** → **GitHub**:

- Enable GitHub
- Paste Client ID + Client secret
- Save

### 3. Redirect URLs

**Authentication** → **URL Configuration** → add:

```
http://localhost:3000
http://127.0.0.1:3000
https://monster-ai.pages.dev
```

### 4. Client (optional)

```ts
import { getSupabaseClient } from "@/lib/supabaseClient";

const sb = getSupabaseClient();
await sb?.auth.signInWithOAuth({
  provider: "github",
  options: { redirectTo: `${window.location.origin}/guardian-sync` },
});
```

Guardian Ai still uses local-first Node OAuth by default; Supabase GitHub login is optional.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Integration cannot find migrations | Confirm working directory is `deploy`, not `.` |
| Migration already exists | Tables were created manually — reset or skip first migration |
| OAuth redirect error | Callback must be `https://<ref>.supabase.co/auth/v1/callback` exactly |
| Wrong repo connected | Integrations → disconnect → reconnect to `SB00001090/Guardian-Ai` |