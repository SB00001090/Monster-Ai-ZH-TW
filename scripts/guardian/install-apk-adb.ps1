# Guardian Ai - USB install latest APK + adb reverse
# Developed by Suckbob | Guardian Ai
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

function Find-Adb {
    if (Get-Command adb -ErrorAction SilentlyContinue) { return "adb" }
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"),
        (Join-Path $env:USERPROFILE "AppData\Local\Android\Sdk\platform-tools\adb.exe"),
        "C:\Program Files (x86)\Android\android-sdk\platform-tools\adb.exe"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { return $c }
    }
    return $null
}

$adb = Find-Adb
if (-not $adb) {
    Write-Host "[FAIL] adb not found. Install Android Platform Tools or Android Studio SDK."
    Write-Host "  https://developer.android.com/tools/releases/platform-tools"
    exit 1
}

$candidates = @(
    (Join-Path $root "dist\guardian-ai-android-release.apk"),
    (Join-Path $root "dist\guardian-ai-android-debug.apk"),
    (Join-Path $root "apps\guardian-ai-android\app\build\outputs\apk\release\app-release.apk"),
    (Join-Path $root "apps\guardian-ai-android\app\build\outputs\apk\debug\app-debug.apk")
)
$apk = $null
foreach ($c in $candidates) {
    if (Test-Path $c) { $apk = $c; break }
}
if (-not $apk) {
    Write-Host "[FAIL] APK not found. Run: build-guardian-apk.bat"
    exit 1
}

Write-Host "[Guardian Ai] adb: $adb"
Write-Host "[Guardian Ai] apk: $apk"
& $adb devices
$devices = (& $adb devices | Select-String "device$" | Where-Object { $_ -notmatch "List of devices" })
if (-not $devices) {
    Write-Host "[FAIL] No USB device. Enable USB debugging and authorize this PC."
    exit 1
}

& $adb reverse tcp:7860 tcp:7860
& $adb install -r $apk
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$tunnelFile = Join-Path $root "data\guardian-ai\tunnel_url.txt"
if (Test-Path $tunnelFile) {
    Write-Host "[OK] Tunnel URL (optional): $(Get-Content $tunnelFile -Raw)"
}
Write-Host "[OK] Installed Guardian Ai. USB: http://127.0.0.1:7860 via adb reverse"