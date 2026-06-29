# CrimeGuard 緊急網絡恢復（需二次確認 token）
param(
    [string]$ConfirmToken = "",
    [string]$ProjectRoot = ""
)

$ErrorActionPreference = "Stop"
if (-not $ProjectRoot) {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

if (-not $ConfirmToken) {
    $ConfirmToken = Read-Host "輸入恢復 token（預設 MONSTER-RECOVER-2026）"
}
$confirm2 = Read-Host "再次確認恢復網絡？輸入 YES 繼續"
if ($confirm2 -ne "YES") {
    Write-Host "已取消" -ForegroundColor Yellow
    exit 1
}

& (Join-Path $PSScriptRoot "network_lock.ps1") -Action unlock -ConfirmToken $ConfirmToken
Write-Host "[OK] 防火牆規則已移除" -ForegroundColor Green