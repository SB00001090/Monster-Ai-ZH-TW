# Make.com — Guardian Ai 自動化情境

Developed by Suckbob | Guardian Ai

## 情境 A：Git Push → Cloudflare Pages 部署

1. **Trigger**：GitHub — Watch commits on `main`
2. **Action**：HTTP — POST `https://api.cloudflare.com/client/v4/accounts/{account}/pages/projects/monster-ai/deployments`
3. **Filter**：僅 `client/` 或 `functions/` 變更時觸發

## 情境 B：部署失敗通知

1. **Trigger**：Webhook — Cloudflare Pages build failure
2. **Action**：Discord / Email 通知
3. **Action**：HTTP POST Guardian Ai

```http
POST https://{TUNNEL}/api/integrations/make/deploy-hook
X-Make-Secret: {MAKE_WEBHOOK_SECRET}
Content-Type: application/json

{"event": "deploy_failed", "detail": "{{build.log}}"}
```

## 情境 C：品質與課程數據同步

1. **Schedule**：每 6 小時
2. **HTTP GET**：`https://{TUNNEL}/api/integrations/status`
3. **或 HTTP POST**（同一快照）：

```http
POST https://{TUNNEL}/api/integrations/make/deploy-hook
X-Make-Secret: {MAKE_WEBHOOK_SECRET}
Content-Type: application/json

{"event": "integrations_snapshot", "detail": "scheduled"}
```

4. **Store**：Google Sheets — 記錄欄位：
   - `guardian_success.success_rate`（目標 98%）
   - `curriculum.progress_pct` / `curriculum.mode`
   - `mini_success.success_rate`

## 情境 D：Guardian Tunnel 健康監控

1. **Schedule**：每 15 分鐘
2. **HTTP GET**：`https://{TUNNEL}/api/guardian/connection`
3. **Router**：若 `tunnel_url` 為空 → Discord/Email「請執行 run-tunnel.bat」
4. **HTTP GET**：`https://{TUNNEL}/health` — 失敗則進入情境 F

## 情境 E：APK 建置完成通知

1. **Trigger**：GitHub Actions / 本機 webhook `apk_built`
2. **Action**：更新 Wix Landing Page 下載連結（可選）
3. **HTTP POST**：

```json
{"event": "guardian_apk_ready", "detail": "version=1.2.0 sha256=..."}
```

## 情境 F：Sentry Issue → Dify → 自動 Patch

1. **Trigger**：Sentry — Issue Alert（新建 / 回歸）
2. **HTTP POST**：

```http
POST https://{TUNNEL}/api/integrations/sentry/hook
X-Sentry-Hook-Secret: {SENTRY_WEBHOOK_SECRET}
Content-Type: application/json

{
  "action": "created",
  "data": {
    "issue": {
      "id": "{{issue.id}}",
      "title": "{{issue.title}}",
      "culprit": "{{issue.culprit}}",
      "permalink": "{{issue.permalink}}"
    }
  }
}
```

3. **回應欄位**：`guardian.fix_suggestion` · `dify.outputs` · `patch.success`
4. **後續**：若 `patch.success` → Slack 通知 + 可選建立 GitHub PR

## 環境變數

| 變數 | 用途 |
|------|------|
| `MAKE_WEBHOOK_SECRET` | 驗證 `/api/integrations/make/deploy-hook` |
| `SENTRY_WEBHOOK_SECRET` | 驗證 `/api/integrations/sentry/hook` |
| `SENTRY_DSN` | 後端 Sentry 上報 |
| `DIFY_API_KEY` | Dify 錯誤 workflow（`workflow_error_id`） |
| `CLOUDFLARE_API_TOKEN` | Pages 部署 API |
| `GUARDIAN_TUNNEL_URL` | Tunnel HTTPS 公開網址 |
| `MONSTER_TUNNEL_URL` | Dify workflow 變數（同 Tunnel URL） |