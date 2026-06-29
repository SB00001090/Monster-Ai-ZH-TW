# 一鍵建置已簽署 MonsterCallGuard Release APK
param([string]$ProjectRoot = "")

$ErrorActionPreference = "Stop"
if (-not $ProjectRoot) {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

$androidDir = Join-Path $ProjectRoot "apps\monstercallguard-android"
$distDir = Join-Path $ProjectRoot "dist"
$ksProps = Join-Path $androidDir "keystore.properties"

Write-Host "=== MonsterCallGuard Release APK ===" -ForegroundColor Cyan

if (-not (Test-Path $ksProps)) {
    Write-Host "Keystore 不存在，執行 generate-keystore.ps1 ..." -ForegroundColor Yellow
    & (Join-Path $PSScriptRoot "generate-keystore.ps1") -ProjectRoot $ProjectRoot
}

# Android Studio JBR + SDK
$jbr = "C:\Program Files\Android\Android Studio\jbr"
if (Test-Path $jbr) { $env:JAVA_HOME = $jbr }
if (-not $env:ANDROID_HOME -and (Test-Path "$env:LOCALAPPDATA\Android\Sdk")) {
    $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
}
$localProps = Join-Path $androidDir "local.properties"
if (-not (Test-Path $localProps) -and $env:ANDROID_HOME) {
    "sdk.dir=$($env:ANDROID_HOME -replace '\\','\\')" | Set-Content $localProps -Encoding ASCII
}

$gradlew = Join-Path $androidDir "gradlew.bat"
if (-not (Test-Path $gradlew)) {
    Write-Host "請先於 Android Studio 開啟專案並 Sync，或執行: gradle wrapper" -ForegroundColor Yellow
    exit 1
}

Set-Location $androidDir
& $gradlew assembleRelease --no-daemon

$apkSrc = Join-Path $androidDir "app\build\outputs\apk\release\app-release.apk"
if (-not (Test-Path $apkSrc)) {
    Write-Error "Build failed — APK not found at $apkSrc"
}

New-Item -ItemType Directory -Force -Path $distDir | Out-Null
$version = "1.0.0"
$apkDst = Join-Path $distDir "MonsterCallGuard-v$version-signed.apk"
Copy-Item $apkSrc $apkDst -Force

$hash = (Get-FileHash $apkDst -Algorithm SHA256).Hash.ToLower()
$hashFile = "$apkDst.sha256"
"$hash  MonsterCallGuard-v$version-signed.apk" | Set-Content $hashFile -Encoding ASCII

Write-Host "`n[OK] APK: $apkDst" -ForegroundColor Green
Write-Host "SHA256: $hash"
Write-Host "Hash file: $hashFile"

# 可選 QR code
$py = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
if (Test-Path $py) {
    & $py -c @"
try:
    import qrcode
    qr = qrcode.make('file:///$($apkDst -replace '\\','/')')
    qr.save(r'$distDir\install-qr.png')
    print('QR: $distDir\install-qr.png')
except ImportError:
    print('pip install qrcode[pil] for QR generation')
"@ 2>$null
}

Write-Host "`n側載安裝教學: scripts\callguard\INSTALL_SIDELoad.md" -ForegroundColor Cyan