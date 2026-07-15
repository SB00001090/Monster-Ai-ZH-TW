# Guardian Ai - generate Play Store release keystore + keystore.properties
# Developed by Suckbob | Guardian Ai
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$android = Join-Path $root "apps\guardian-ai-android"
$ksDir = Join-Path $android "keystore"
$ksFile = Join-Path $ksDir "guardian-ai.jks"
$propsFile = Join-Path $android "keystore.properties"

if (-not $env:JAVA_HOME) {
    $candidates = @(
        "C:\Program Files\Android\Android Studio\jbr",
        "C:\Program Files\Java\jdk-17",
        "$env:LOCALAPPDATA\Programs\Android Studio\jbr"
    )
    foreach ($c in $candidates) {
        if (Test-Path (Join-Path $c "bin\keytool.exe")) {
            $env:JAVA_HOME = $c
            break
        }
    }
}
$keytool = Join-Path $env:JAVA_HOME "bin\keytool.exe"
if (-not (Test-Path $keytool)) {
    Write-Host "[FAIL] keytool not found. Set JAVA_HOME or install Android Studio."
    exit 1
}

if (Test-Path $ksFile) {
    Write-Host "[OK] Keystore already exists: $ksFile"
    Write-Host "[INFO] Delete it first if you need a new one."
    exit 0
}

$storePass = $env:GUARDIAN_KEYSTORE_PASSWORD
$keyPass = $env:GUARDIAN_KEY_PASSWORD
if (-not $storePass) {
    $storePass = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
    Write-Host "[INFO] Generated store password (save it): $storePass"
}
if (-not $keyPass) {
    $keyPass = $storePass
}

New-Item -ItemType Directory -Force -Path $ksDir | Out-Null
$dname = "CN=Guardian Ai, OU=Mobile, O=Suckbob, L=Hong Kong, ST=HK, C=HK"
& $keytool -genkeypair `
    -alias guardian_ai `
    -keyalg RSA `
    -keysize 2048 `
    -validity 10000 `
    -storetype JKS `
    -keystore $ksFile `
    -storepass $storePass `
    -keypass $keyPass `
    -dname $dname

$props = @"
storeFile=keystore/guardian-ai.jks
storePassword=$storePass
keyAlias=guardian_ai
keyPassword=$keyPass
"@
$props | Set-Content -Path $propsFile -Encoding ASCII -NoNewline
Add-Content -Path $propsFile -Value ""

Write-Host "[OK] Keystore -> $ksFile"
Write-Host "[OK] Properties -> $propsFile"
Write-Host "[WARN] Back up passwords securely - required for all future Play updates."
Write-Host "[NEXT] build-guardian-apk.bat  (release)  or  gradlew bundleRelease  (AAB)"