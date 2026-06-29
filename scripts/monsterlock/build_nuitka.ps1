# MonsterLock 核心模組 Nuitka 原生編譯（控制流保護 + 無 .py 原始碼）
param(
    [string]$ProjectRoot = "",
    [switch]$Release
)

$ErrorActionPreference = "Stop"
if (-not $ProjectRoot) {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}
Set-Location $ProjectRoot

$py = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$outDir = Join-Path $ProjectRoot "dist\monsterlock_native"
$core = Join-Path $ProjectRoot "monster_ai\protection\monsterlock"

Write-Host "=== MonsterLock Nuitka 編譯 ===" -ForegroundColor Cyan
& $py -m pip install -q nuitka ordered-set zstandard

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$modules = @(
    "engine.py",
    "crypto.py",
    "hardware.py",
    "anti_debug.py",
    "key_vault.py",
    "layered_crypto.py",
    "self_destruct.py",
    "signatures.py",
    "config_guard.py"
)

$nuitkaArgs = @(
    "-m", "nuitka",
    "--module",
    "--assume-yes-for-downloads",
    "--output-dir=$outDir",
    "--nofollow-import-to=tests",
    "--nofollow-import-to=pytest"
)
if ($Release) {
    $nuitkaArgs += @(
        "--lto=yes",
        "--remove-output"
    )
}

foreach ($mod in $modules) {
    $src = Join-Path $core $mod
    Write-Host "Compiling $mod ..." -ForegroundColor Yellow
    & $py @nuitkaArgs $src
}

$stamp = @{
    built_at = (Get-Date).ToUniversalTime().ToString("o")
    modules  = $modules
    release  = [bool]$Release
} | ConvertTo-Json
$stamp | Set-Content (Join-Path $outDir "build.json") -Encoding UTF8

Write-Host "[OK] Nuitka 輸出: $outDir" -ForegroundColor Green
Write-Host "啟動時 engine 會偵測 dist/monsterlock_native 並標記 nuitka_build=true"