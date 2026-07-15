# Guardian Ai — Privacy Policy / 隱私政策

**Developed by Suckbob | Guardian Ai**  
**Last updated:** 2026-07-05

---

## English

### Who we are
Guardian Ai is published by Suckbob as a local-first creative and security platform.

### Data we process
- **Preferences and sync bundles** (E2E encrypted on device)
- **OC character cards** (local fingerprint + optional cloud sync)
- **Cloudflare Tunnel URL** (stored locally on device)
- **Optional network learning** (opt-in only; public tech/news topics, no PII upload)

### Where data lives
- **Local-first:** encrypted on your device (EncryptedSharedPreferences, AES vaults)
- **Optional sync:** Google Drive API — **your** account, ciphertext only
- **Remote connection:** only to **your** Guardian Ai PC via **Cloudflare Tunnel HTTPS**

### Third-party services
- **Google Play Billing** — purchase verification only
- **Google / GitHub / Discord OAuth** — identity for sync (optional)
- **Sentry** (optional) — crash metadata if you enable telemetry

### Disclaimer
See `GET /api/guardian/disclaimer` — hardcoded, cannot be disabled.

---

## 繁體中文

### 我們是誰
Guardian Ai 由 Suckbob 開發，為本地優先的創意與安全平台。

### 我們處理的資料
- **偏好設定與同步 bundle**（裝置端 E2E 加密）
- **OC 角色卡**（本地指紋 + 可選雲端同步）
- **Cloudflare Tunnel URL**（僅存於本機）
- **可選網絡學習**（須明確同意；僅公開技術/新聞主題，不上傳個人資料）

### 資料存放位置
- **本地優先**：EncryptedSharedPreferences、AES vault 加密儲存
- **可選同步**：Google Drive API — **您自己的**帳戶，僅密文
- **遠端連線**：僅透過 **Cloudflare Tunnel HTTPS** 連接家中 Guardian Ai

僅透過您自架的 **Cloudflare Tunnel 公開 HTTPS URL** 連接家中 Guardian Ai。**不使用 Tailscale，不需輸入 IP。**

### 免責聲明
見 `GET /api/guardian/disclaimer?locale=zh-TW` — 硬編碼，無法關閉。