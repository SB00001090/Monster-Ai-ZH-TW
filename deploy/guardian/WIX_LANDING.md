# Guardian Ai — Wix Landing Page Guide

Developed by Suckbob | Guardian Ai

複製以下結構至 Wix Editor。主應用仍託管於 Cloudflare Pages，Wix 僅作行銷落地頁。

---

## 頁面結構

### 1. Hero

**標題（繁中）：** Guardian Ai — 本地優先 AI 安全平台  
**副標：** OC 保護 · 加密同步 · 自癒防火牆 · Grok 監督學習

**CTA 按鈕：**
- 立即試用 → `https://monster-ai.pages.dev?ref=wix&utm_source=guardian`
- 下載 APK → GitHub Releases（情境 E 自動更新連結）

### 2. 核心功能（6 欄）

| 功能 | 說明 |
|------|------|
| 幼兒教育式學習 | 由淺入深、Grok 監督整個學習週期 |
| OC 反抄襲 | 文字指紋 + 圖片 pHash + `MGA-` 浮水印 |
| 加密訓練庫 | AES-256-GCM `.mgtrain`，禁止明文資產 |
| E2E 雲端同步 | Google/GitHub OAuth + 通行碼 |
| 自癒防火牆 | 隔離區、語音騷擾偵測、規則自修復 |
| 多模態生成 | SD/Flux/Pony/Aurora，98% 品質追蹤 |

### 3. 連線方式

- **USB（推薦）：** `install-apk-adb.bat` + `adb reverse`
- **遠端：** Cloudflare Tunnel `*.trycloudflare.com`
- **已移除：** Tailscale、QR Code 配對

### 4. 定價

- 7 日免費試用（App 內，非訂閱）
- 一次性永久解鎖：HKD 388 / TWD 999 / USD 29–49
- API：`GET /api/commercial/pricing?region=HK`

**CTA：** `https://monster-ai.pages.dev/guardian-sync?ref=wix`

### 5. Trust & Legal

- 18+ 年齡驗證
- 免責聲明：`GET /api/guardian/disclaimer?locale=zh-TW`
- 隱私政策：公開 `PRIVACY_POLICY.md` HTTPS 連結
- Developed by Suckbob | Guardian Ai

### 6. SEO（Ahrefs）

見 `deploy/ahrefs/SEO_PLAN.md`。Guardian 目標詞：

- local AI security platform
- OC character protection AI
- encrypted AI training vault
- Cloudflare Tunnel Android sync

UTM：`?ref=wix&utm_source=ahrefs&utm_campaign=guardian`

---

## Wix Custom Code（Head）

```html
<script>
  window.GUARDIAN_APP_URL = "https://monster-ai.pages.dev";
  window.GUARDIAN_TUNNEL_DOCS = "https://github.com/SB00001090/Guardian-Ai/blob/main/apps/guardian-ai-android/docs/TUNNEL_SETUP.md";
</script>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Guardian Ai",
  "applicationCategory": "SecurityApplication",
  "operatingSystem": "Android, Windows, macOS",
  "offers": { "@type": "Offer", "price": "388", "priceCurrency": "HKD" },
  "author": { "@type": "Organization", "name": "Suckbob" }
}
</script>
```

## 所有 CTA 規則

- 主應用 URL：`https://monster-ai.pages.dev`（勿在 Wix 託管後端）
- APK：GitHub Releases `Guardian-Ai`
- 遠端 API：使用者自架 Tunnel URL，勿寫死 IP