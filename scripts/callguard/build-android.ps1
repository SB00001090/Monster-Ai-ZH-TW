# 建置 MonsterCallGuard Android APK
param([string]$ProjectRoot = "")

if (-not $ProjectRoot) {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}
$androidDir = Join-Path $ProjectRoot "apps\monstercallguard-android"

Write-Host "=== Build MonsterCallGuard APK ===" -ForegroundColor Cyan
Write-Host "建議使用 Release 簽署建置:" -ForegroundColor Yellow
Write-Host "  scripts\callguard\build-release-apk.ps1"
& (Join-Path $PSScriptRoot "build-release-apk.ps1") -ProjectRoot $ProjectRoot