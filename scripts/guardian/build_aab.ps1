# Guardian Ai - build Play Store AAB (bundleRelease)
# Developed by Suckbob | Guardian Ai
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$android = Join-Path $root "apps\guardian-ai-android"
$ksFile = Join-Path $android "keystore\guardian-ai.jks"
$propsFile = Join-Path $android "keystore.properties"

if (-not (Test-Path $ksFile) -or -not (Test-Path $propsFile)) {
    Write-Host "[FAIL] Release keystore missing. Run: gen-release-keystore.bat"
    exit 1
}

function Resolve-AndroidSdk {
    $candidates = @(
        $env:ANDROID_HOME,
        $env:ANDROID_SDK_ROOT,
        (Join-Path $env:LOCALAPPDATA "Android\Sdk"),
        "C:\Android\Sdk"
    ) | Where-Object { $_ -and (Test-Path $_) }
    return $candidates | Select-Object -First 1
}

$sdk = Resolve-AndroidSdk
$localProps = Join-Path $android "local.properties"
if (-not $sdk) {
    Write-Host "[FAIL] Android SDK not found. Install Android Studio or set ANDROID_HOME."
    exit 1
}
$escaped = $sdk -replace "\\", "\\\\"
$needProps = -not (Test-Path $localProps)
if (-not $needProps) {
    $current = Get-Content $localProps -Raw -ErrorAction SilentlyContinue
    if ($current -notmatch [regex]::Escape($escaped)) { $needProps = $true }
}
if ($needProps) {
    "sdk.dir=$escaped" | Set-Content -Path $localProps -Encoding ASCII
    Write-Host "[OK] Wrote local.properties -> $sdk"
}
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk

if (-not $env:JAVA_HOME) {
    $candidates = @(
        "C:\Program Files\Android\Android Studio\jbr",
        "C:\Program Files\Java\jdk-17",
        "$env:LOCALAPPDATA\Programs\Android Studio\jbr"
    )
    foreach ($c in $candidates) {
        if (Test-Path (Join-Path $c "bin\java.exe")) {
            $env:JAVA_HOME = $c
            break
        }
    }
}
if (-not $env:JAVA_HOME) {
    Write-Host "[FAIL] JAVA_HOME not set. Install JDK 17+ or Android Studio."
    exit 1
}

Push-Location $android
try {
    .\gradlew.bat bundleRelease --no-daemon
    $aab = Join-Path $android "app\build\outputs\bundle\release\app-release.aab"
    if (-not (Test-Path $aab)) {
        Write-Host "[FAIL] AAB not produced at $aab"
        exit 1
    }
    $dist = Join-Path $root "dist"
    New-Item -ItemType Directory -Force -Path $dist | Out-Null
    $dest = Join-Path $dist "guardian-ai-android-release.aab"
    Copy-Item $aab $dest -Force
    Write-Host "[OK] AAB -> $dest"
} finally {
    Pop-Location
}