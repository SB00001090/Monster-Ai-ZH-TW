# MonsterCallGuard 側載安裝教學

純 APK 模式 · 無 Google Play · 無廣告 · 無 Google Play Services 依賴

## 1. 下載 APK

從以下任一來源取得已簽署 APK：

- `dist/MonsterCallGuard-v1.0.0-signed.apk`
- 家中 Monster AI Dashboard 下載連結
- QR Code 掃描（`dist/install-qr.png`）

## 2. 驗證完整性（建議）

比對 SHA256：

```powershell
Get-FileHash dist\MonsterCallGuard-v1.0.0-signed.apk -Algorithm SHA256
# 與 dist\MonsterCallGuard-v1.0.0-signed.apk.sha256 比對
```

## 3. 側載安裝

1. 將 APK 傳到手機
2. **設定 → 安全性 → 安裝未知應用程式**
3. 允許使用的瀏覽器或檔案管理員
4. 點擊 APK 安裝

## 4. 必要權限與角色

開啟 MonsterCallGuard 後依序：

| 步驟 | 操作 |
|------|------|
| 1 | 授予電話、通話紀錄、通知權限 |
| 2 | 點「啟用來電篩選」→ 設為預設 Call Screening App |
| 3 | 點「啟動背景保護服務」→ 確認通知列常駐 |
| 4 | （可選）設定家中 Monster AI IP / Tailscale |

## 5. 家中 Monster AI 連線

| 模式 | App 設定 |
|------|----------|
| 區域網路 | LAN IP 例 `192.168.1.50` |
| Tailscale | 主機名 例 `monster-ai.tail12345.ts.net` |
| 手動 | 完整 URL 例 `http://192.168.1.50:7860` |

測試：點「測試家中 Monster AI 連線」

## 6. 安全說明

- **無廣告**，不蒐集通話錄音
- 舉報僅上傳 **SHA256 號碼 hash**，不含完整電話號碼
- 網絡鎖定使用本機 VPN，可於 App 內「解除網絡鎖定」
- 開源可審計，附 APK SHA256 指紋

## 7. 匿名舉報渠道

- **ADCC 18222**：App 內一鍵撥打
- **e-報案中心**：https://www.ereporting.rmp.gov.hk
- **Scameter+**：https://cyberdefender.hk/scameter/

## 8. 疑難排解

| 問題 | 解法 |
|------|------|
| 無法安裝 | 開啟未知來源；確認 APK 未損壞 |
| 來電未攔截 | 確認已設為「來電篩選」預設 App（Android 10+） |
| 通知消失 | 關閉電池最佳化；重新啟動背景保護 |
| 家中連線失敗 | 同一 Wi-Fi 或 Tailscale；防火牆開 7860 |
| VPN 鎖定後無網 | App →「解除網絡鎖定」 |
| 威脅庫未更新 | 設定家中 IP；或部署 `dist/threat_db.json` 至 CDN |

## 9. 建置 APK（開發者）

```powershell
scripts\callguard\generate-keystore.ps1
scripts\callguard\build-release-apk.ps1
```