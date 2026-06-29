# MonsterLock v2 強化版指南

## 架構（六層防護）

```
L6 Config Guard     → 改 config.yaml 關閉保護 = 啟動拒絕 + 可觸發自毀
L5 DPAPI Key Vault  → 金鑰僅運行時衍生，sealed_entropy 綁定本機
L4 分層加密 v3      → LoRA/模型 .mlck3 分塊 AES-256 streaming
L3 Ed25519 簽章     → 關鍵檔案數位簽章驗證
L2 行為監控         → memory dump 工具 / config 修改 / python 除錯
L1 反分析           → NtQueryInformationProcess + 計時檢測 + 程序黑名單
```

## 一鍵部署

```powershell
cd C:\MonsterAI\monster-ai
.\scripts\monsterlock\install-monsterlock.ps1 -BindHardware -Hardened -EncryptAssets
.\scripts\monsterlock\build_nuitka.ps1 -Release
.\scripts\monsterlock\test-protection.ps1
.\scripts\monsterlock\simulate_attacks.ps1
```

## 攻擊模擬

| 攻擊手法 | 預期反應 |
|----------|----------|
| 改 config 關閉 MonsterLock | Config Guard 阻擋啟動 |
| 複製資料夾到其他機器 | 硬體不符 + DPAPI 無法解封 |
| 篡改 firewall.py | 簽章/雜湊失敗 → 修復或自毀 |
| 開啟 x64dbg / procdump | 反分析觸發 → 阻擋或自毀 |
| memory dump | 行為監控評分上升 |

## 復原（合法管理員）

```powershell
# 1. 停止服務
# 2. 刪除 seal 並用官方腳本重設
Remove-Item data\monsterlock\config.seal -ErrorAction SilentlyContinue
.\scripts\monsterlock\enable-monsterlock.ps1 -Hardened
.\scripts\monsterlock\bind_hardware.py
```

## RTX 4090 效能建議

- 大模型用 `--layered` 加密，運行時 `stream_model_chunks()` 串流解密
- `check_interval_seconds: 30`（勿低於 10）
- `force_exit_on_destruct: false` 避免生產環境誤觸強制退出

## 限制（誠實說明）

即使 v2 強化，**本機 Admin + 充足時間**仍可能透過核心轉儲、核心除錯器繞過。v2 目標是大幅提高成本並讓複製品在偵測後**自動報廢**。