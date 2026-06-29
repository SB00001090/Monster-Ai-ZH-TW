# MonsterLock 保護強度測試
param([string]$ProjectRoot = "")

$ErrorActionPreference = "Continue"
if (-not $ProjectRoot) {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}
Set-Location $ProjectRoot
$py = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $py)) { $py = "python" }

Write-Host "=== MonsterLock 保護測試 ===" -ForegroundColor Cyan

Write-Host "`n[1/5] 硬體指紋" -ForegroundColor Yellow
& $py (Join-Path $PSScriptRoot "bind_hardware.py") --show-only

Write-Host "`n[2/5] 單元測試" -ForegroundColor Yellow
& $py -m pytest tests/test_monsterlock.py -q

Write-Host "`n[3/5] 加密往返測試" -ForegroundColor Yellow
& $py (Join-Path $PSScriptRoot "test_crypto_roundtrip.py")

Write-Host "`n[4/5] 完整性清單" -ForegroundColor Yellow
& $py (Join-Path $PSScriptRoot "build_manifest.py")

Write-Host "`n[5/5] API 狀態（需服務運行中）" -ForegroundColor Yellow
try {
    $r = Invoke-RestMethod -Uri "http://127.0.0.1:7860/api/security/monsterlock" -TimeoutSec 3
    Write-Host "  armed=$($r.armed) green_dot=$($r.green_dot) strength=$($r.strength)"
} catch {
    Write-Host "  服務未運行 — 略過 API 測試" -ForegroundColor DarkYellow
}

Write-Host "`n=== 測試完成 ===" -ForegroundColor Green