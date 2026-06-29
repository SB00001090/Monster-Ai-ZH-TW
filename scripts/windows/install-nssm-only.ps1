# Download NSSM only (fix nssm.cc 503 in browser)
# Run: powershell -ExecutionPolicy Bypass -File scripts\windows\install-nssm-only.ps1

$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$NssmDir = Join-Path $Root "tools\nssm"
$NssmExe = Join-Path $NssmDir "nssm.exe"
New-Item -ItemType Directory -Force -Path $NssmDir | Out-Null

Write-Host "Method 1: winget..."
winget install NSSM.NSSM --accept-package-agreements --accept-source-agreements
$w = "${env:ProgramFiles}\NSSM\nssm.exe"
if (Test-Path $w) {
    Copy-Item $w $NssmExe -Force
    Write-Host "OK: $NssmExe"
    exit 0
}

Write-Host "Method 2: curl download..."
$zip = "$env:TEMP\nssm-2.24.zip"
curl.exe -sL -o $zip "https://nssm.cc/release/nssm-2.24.zip"
Expand-Archive -Path $zip -DestinationPath "$env:TEMP\nssm-extract" -Force
Copy-Item "$env:TEMP\nssm-extract\nssm-2.24\win64\nssm.exe" $NssmExe -Force
Write-Host "OK: $NssmExe"