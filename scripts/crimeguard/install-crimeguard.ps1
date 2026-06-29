# CrimeGuard one-click install
param([string]$ProjectRoot = "")

$ErrorActionPreference = "Stop"
if (-not $ProjectRoot) {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}
Set-Location $ProjectRoot

Write-Host "=== CrimeGuard Install ===" -ForegroundColor Cyan
$py = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $py)) { python -m venv .venv; $py = Join-Path $ProjectRoot ".venv\Scripts\python.exe" }

New-Item -ItemType Directory -Force -Path "data\crimeguard" | Out-Null

& (Join-Path $PSScriptRoot "enable-crimeguard.ps1") -ProjectRoot $ProjectRoot
& $py (Join-Path $PSScriptRoot "update_hk_rules.py")

Write-Host "[OK] CrimeGuard install complete (含設備聯繫即時反制)" -ForegroundColor Green
Write-Host "Test:  .\scripts\crimeguard\test-crimeguard.ps1"
Write-Host "Sim:   .\scripts\crimeguard\simulate_device_contact.ps1"