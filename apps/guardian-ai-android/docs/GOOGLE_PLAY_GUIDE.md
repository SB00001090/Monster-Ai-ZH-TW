# Google Play 上架指南 — Guardian Ai

**Developed by Suckbob | Guardian Ai**

## 1. 生成 AAB

```bash
cd apps/guardian-ai-android
gradlew.bat bundleRelease
```

產物：`app/build/outputs/bundle/release/app-release.aab`

## 2. Play Console 設定

### App 內容
- [ ] 隱私政策 URL（`PRIVACY_POLICY.md`）
- [ ] 資料安全表單：偏好設定、同步 bundle（E2E 加密）
- [ ] 18+ 年齡驗證說明

### 一次性產品
- Product ID: `guardian_ai_lifetime`
- 類型：In-app product (one-time)
- **區域定價建議：**
  - 香港 HKD 388
  - 台灣 TWD 999
  - 美國 USD 29–49

### 試用說明
試用由 App 內 `TrialManager` 實現（7 日），**非** Play 訂閱試用。

## 3. Policy Checklist

| 項目 | 狀態 |
|------|------|
| POST_NOTIFICATIONS | Android 13+ |
| Billing permission | `com.android.vending.BILLING` |
| 無誤導性一次性付費描述 | 強調無訂閱 |
| targetSdk 34 | ✅ |
| 64-bit ABI | ✅ (bundle splits) |

## 4. 商店描述要點（中英）

**EN:** One-time purchase. 7-day free trial. Local-first Guardian Ai — OC anti-plagiarism, encrypted training vault, E2E sync. Connects via Cloudflare Tunnel HTTPS.

**ZH:** 一次付費永久使用，無訂閱。7 日免費試用。本地 Guardian Ai — OC 反抄襲、加密訓練庫、E2E 同步。Cloudflare Tunnel HTTPS 連線。