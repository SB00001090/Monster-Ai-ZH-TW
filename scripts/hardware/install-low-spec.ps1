# 低配一鍵安裝 — Q4 模型提示 + tier 偵測
param([string]$ProjectRoot = "")

$ErrorActionPreference = "Stop"
if (-not $ProjectRoot) {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}
Set-Location $ProjectRoot

Write-Host "=== 低配安裝 ===" -ForegroundColor Cyan
& (Join-Path $PSScriptRoot "detect-tier.ps1") -ProjectRoot $ProjectRoot

Write-Host "`n建議拉取量化模型:" -ForegroundColor Yellow
Write-Host "  ollama pull llama3.2:3b"
Write-Host "  (可選) ollama pull llama3.2:3b-instruct-q4_K_M"

& (Join-Path $ProjectRoot "scripts\crimeguard\install-crimeguard.ps1") -ProjectRoot $ProjectRoot

Write-Host "`n[OK] 低配安全模組已啟用" -ForegroundColor Green