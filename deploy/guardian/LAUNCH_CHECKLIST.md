# Guardian Ai 上架 Checklist

Developed by Suckbob | Guardian Ai

## 核心功能

- [x] `GET /api/guardian/training/status` → `encrypted: true`, `plaintext_forbidden: true`
- [x] 好圖/爛圖存為 `.mgtrain`（`test_guardian_training_vault.py`）
- [x] `POST /api/guardian/training/migrate` 將舊 `quality/good|bad` 轉為加密
- [x] 訓練金鑰綁定 MonsterLock 指紋或 Android Keystore（`key_manager.py` + `TrainingVaultKeyManager.kt`）
- [x] 雲端 sync `training_vault` bundle 為端到端密文（`test_sync_training_vault_ciphertext_at_rest`）
- [x] `GET /api/guardian/status` → `no_tailscale: true`, `no_qr_code: true`
- [x] `GET /api/guardian/disclaimer` 含「可能性無法退款」
- [x] Google / GitHub OAuth 登入後可 `sync/upload` + `sync/download`（Web `/guardian-sync`）
- [x] Android Guardian 同步畫面 + `GuardianSyncWorker`
- [x] Electron `guardianVault` safeStorage 金鑰
- [x] 錯誤觸發 `errors/report` 回傳 `fix_suggestion` + `code_snippet`
- [x] `learning/supervise` 回傳 Grok `priorities`
- [x] `quality/gate` score < 0.70 → `fail`
- [x] `oc/protect` 產生 `MGA-` 浮水印

## 連接與部署

- [x] 一鍵自動：`auto-guardian.bat` 或 `py -3.11 scripts/guardian/auto_start.py`
- [x] `python scripts/deploy_cloudflare.py --tunnel` 取得 HTTPS URL（`auto_start.py` 已自動化）
- [x] `GUARDIAN_TUNNEL_URL` 寫入 `data/guardian-ai/tunnel_url.txt`
- [x] Android `TunnelConnection.kt` 拒絕 Tailscale / IP
- [x] USB：`scripts/guardian/install-apk-adb.ps1` 安裝最新 APK（`build-guardian-apk.bat` → `dist/guardian-ai-android-debug.apk`）
- [x] **無 QR Code**（`grep -ri qrserver` 為空）

## 整合

- [x] Dify：匯出檔 `deploy/dify/workflow_guardian.json`（匯入後填 `workflow_error_id`）
- [ ] Sentry：`SENTRY_DSN` + `VITE_SENTRY_DSN`（`scripts/guardian/check_env.py` 檢查）
- [ ] Make：deploy 成功 → Slack 通知（`MAKE_WEBHOOK_SECRET` + `deploy/make/SCENARIO.md`）
- [x] HF Space：`deploy/huggingface/app.py`（部署檔就緒）
- [ ] Wix Landing + Ahrefs SEO（文案：`deploy/guardian/WIX_LANDING.md`）

## 商業

- [x] 7 日試用 `POST /api/commercial/trial/start`
- [x] 區域定價 HKD 388 / TWD 999 / USD 29–49（`GET /api/commercial/pricing`）

## 測試

```bash
auto-guardian.bat
auto-guardian.bat --verify
py -3.11 scripts/guardian/bootstrap_env.py
py -3.11 scripts/guardian/check_env.py
build-guardian-apk.bat
install-apk-adb.bat
```

## 法律

- [x] 18+ Age Verification（React `AgeVerification.tsx`）
- [x] Guardian 免責聲明不可被 config 關閉（`disclaimer.py` 硬編碼）
- [x] PRIVACY_POLICY.md 更新 Cloudflare Tunnel 說明