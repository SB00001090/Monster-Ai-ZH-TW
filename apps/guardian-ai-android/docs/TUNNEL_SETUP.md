# Cloudflare Tunnel 設定 — Guardian Ai

**Developed by Suckbob | Guardian Ai**

## 架構

```
[Android App] ──HTTPS──► [*.trycloudflare.com] ──cloudflared──► [127.0.0.1:7860 main.py]
[Web UI]      ──HTTPS──► [monster-ai.pages.dev]  ──VITE_MONSTER_API_URL──► 同上 Tunnel
```

- **唔使輸入 IP**
- **完全唔用 Tailscale**
- **無 QR Code**
- 所有請求走 **HTTPS**（TLS 由 Cloudflare 終止）

## 電腦端步驟

### 1. 啟動 Guardian Ai 後端

```bat
cd C:\MonsterAI\monster-ai
python main.py
```

確認：`http://127.0.0.1:7860/health` → `{"status":"ok",...}`

### 2. 啟動 Quick Tunnel

```bat
scripts\guardian\run-tunnel.bat
```

或：

```bat
python scripts\deploy_cloudflare.py --tunnel
```

複製輸出中的 URL，例如：

```
https://requirements-controversy-length-pam.trycloudflare.com
```

URL 自動儲存至 `data\guardian-ai\tunnel_url.txt`。

## Android App 設定

1. 安裝最新 APK（見 `USB_ADB_INSTALL.md`）
2. 開啟 App → **Cloudflare Tunnel URL** 欄位
3. 貼上完整 `https://xxx.trycloudflare.com`（**勿加 :7860**）
4. 按 **儲存 Tunnel URL** → **測試連線**

## 連線範例（Kotlin / Retrofit）

```kotlin
val baseUrl = "https://xxx.trycloudflare.com/"
val api = Retrofit.Builder()
    .baseUrl(baseUrl)
    .client(okHttp)
    .build()
    .create(MonsterApiService::class.java)

// Guardian status
api.guardianStatus()
```

## 離線快取

| 檔案 | 用途 |
|------|------|
| `last_health.json` | 上次成功 `/health` 回應 |