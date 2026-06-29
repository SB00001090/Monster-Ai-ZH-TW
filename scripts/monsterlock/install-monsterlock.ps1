# MonsterLock 一鍵安裝腳本
#Requires -Version 5.1
param(
    [string]$ProjectRoot = "",
    [ValidateSet("light", "standard", "strict")]
    [string]$Strength = "strict",
    [switch]$Hardened,
    [switch]$BindHardware,
    [switch]$EncryptAssets,
    [switch]$SkipDeps
)

$ErrorActionPreference = "Stop"
if (-not $ProjectRoot) {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}
Set-Location $ProjectRoot

Write-Host "=== MonsterLock 安裝 ===" -ForegroundColor Cyan
Write-Host "專案路徑: $ProjectRoot"

# 1) Python 依賴
if (-not $SkipDeps) {
    $venvPy = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
    if (-not (Test-Path $venvPy)) {
        Write-Host "建立虛擬環境..." -ForegroundColor Yellow
        python -m venv .venv
    }
    & $venvPy -m pip install -q cryptography pyyaml
    Write-Host "[OK] cryptography 已安裝" -ForegroundColor Green
}

# 2) 資料目錄
$dirs = @(
    "data\monsterlock",
    "data\monsterlock\backup",
    "data\monsterlock\vault",
    "data\logs\security"
)
foreach ($d in $dirs) {
    New-Item -ItemType Directory -Force -Path (Join-Path $ProjectRoot $d) | Out-Null
}

# 3) 啟用 config.yaml（強化模式）
if ($Hardened -or $Strength -eq "strict") {
    & (Join-Path $PSScriptRoot "enable-monsterlock.ps1") -Strength $Strength -Hardened
} else {
    & (Join-Path $PSScriptRoot "enable-monsterlock.ps1") -Strength $Strength
}

# 4) 硬體綁定
if ($BindHardware) {
    $py = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
    & $py (Join-Path $PSScriptRoot "bind_hardware.py")
}

# 5) 加密資產
if ($EncryptAssets) {
    $py = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
    & $py (Join-Path $PSScriptRoot "encrypt_assets.py") --all
}

# 6) 建立完整性清單
$py = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
& $py (Join-Path $PSScriptRoot "build_manifest.py")

# 7) 註冊每日威脅更新排程（可選）
$taskScript = Join-Path $PSScriptRoot "register_daily_update.ps1"
if (Test-Path $taskScript) {
    try {
        & $taskScript
    } catch {
        Write-Warning "每日更新排程註冊失敗（可稍後手動執行）: $_"
    }
}

Write-Host ""
Write-Host "=== MonsterLock 安裝完成 ===" -ForegroundColor Green
Write-Host "下一步: .\scripts\monsterlock\configure-monsterlock.ps1"
Write-Host "測試:   .\scripts\monsterlock\test-protection.ps1"