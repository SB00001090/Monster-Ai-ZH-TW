# 產生 MonsterCallGuard 簽署金鑰（側載 APK）
param([string]$ProjectRoot = "")

$ErrorActionPreference = "Stop"
if (-not $ProjectRoot) {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

$ksDir = Join-Path $ProjectRoot "apps\monstercallguard-android\keystore"
$ksFile = Join-Path $ksDir "monster-callguard.jks"
$propsFile = Join-Path $ProjectRoot "apps\monstercallguard-android\keystore.properties"

New-Item -ItemType Directory -Force -Path $ksDir | Out-Null

function Find-Keytool {
    if (Get-Command keytool -ErrorAction SilentlyContinue) { return "keytool" }
    $candidates = @(
        "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe",
        "$env:JAVA_HOME\bin\keytool.exe",
        "C:\Program Files\Java\*\bin\keytool.exe"
    )
    foreach ($c in $candidates) {
        $resolved = Get-Item $c -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($resolved) { return $resolved.FullName }
    }
    return $null
}

$keytool = Find-Keytool
if (-not $keytool) {
    Write-Host "找不到 keytool。請安裝 JDK 或 Android Studio，並設定 JAVA_HOME。" -ForegroundColor Yellow
    Write-Host "仍可手動建立 keystore.properties 後用 Android Studio 簽署。" -ForegroundColor Yellow
}

if (Test-Path $ksFile) {
    Write-Host "Keystore 已存在: $ksFile" -ForegroundColor Yellow
} elseif ($keytool) {
    $pass = "monster-callguard-2026"
    & $keytool -genkeypair -v `
        -keystore $ksFile `
        -alias callguard `
        -keyalg RSA -keysize 2048 -validity 10000 `
        -storepass $pass -keypass $pass `
        -dname "CN=MonsterCallGuard, OU=Security, O=MonsterAI, L=HongKong, ST=HK, C=HK"
    Write-Host "[OK] Keystore created: $ksFile" -ForegroundColor Green
} elseif (-not (Test-Path $ksFile)) {
    Write-Host "略過 keystore 產生 — 請用 Android Studio Build > Generate Signed APK" -ForegroundColor DarkYellow
}

if (-not (Test-Path $propsFile)) {
    @"
storeFile=keystore/monster-callguard.jks
storePassword=monster-callguard-2026
keyAlias=callguard
keyPassword=monster-callguard-2026
"@ | Set-Content -Path $propsFile -Encoding UTF8
    Write-Host "[OK] keystore.properties created" -ForegroundColor Green
}

Write-Host "`nIMPORTANT: 生產環境請更換 keystore 密碼並妥善保管 .jks 檔案" -ForegroundColor Cyan