# Guardian Ai - build release APK
# Developed by Suckbob | Guardian Ai
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$android = Join-Path $root "apps\guardian-ai-android"
if (-not (Test-Path (Join-Path $android "gradlew.bat"))) {
    Write-Host "[FAIL] gradlew.bat not found under apps/guardian-ai-android"
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
$keystore = Join-Path $android "keystore\guardian-ai.jks"
$propsFile = Join-Path $android "keystore.properties"
if (-not (Test-Path $keystore)) {
    $gen = Join-Path $PSScriptRoot "gen_release_keystore.ps1"
    if (Test-Path $gen) {
        Write-Host "[WARN] Release keystore missing - generating..."
        & $gen
    }
}
$task = if ((Test-Path $keystore) -and (Test-Path $propsFile)) { "assembleRelease" } else {
    Write-Host "[WARN] Release keystore missing - building debug APK for USB testing"
    "assembleDebug"
}
Push-Location $android
try {
    .\gradlew.bat $task --no-daemon
    $flavor = if ($task -eq "assembleRelease") { "release\app-release" } else { "debug\app-debug" }
    $apk = Join-Path $android "app\build\outputs\apk\$flavor.apk"
    if (-not (Test-Path $apk)) {
        Write-Host "[FAIL] APK not produced at $apk"
        exit 1
    }
    $dist = Join-Path $root "dist"
    New-Item -ItemType Directory -Force -Path $dist | Out-Null
    $name = if ($task -eq "assembleRelease") { "guardian-ai-android-release.apk" } else { "guardian-ai-android-debug.apk" }
    $dest = Join-Path $dist $name
    Copy-Item $apk $dest -Force
    Write-Host "[OK] APK -> $dest"
} finally {
    Pop-Location
}