# 使用 PyArmor 混淆 MonsterLock 核心（可選）
param(
    [ValidateSet("pyarmor", "nuitka")]
    [string]$Tool = "pyarmor"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$py = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$coreDir = Join-Path $ProjectRoot "monster_ai\protection\monsterlock"
$outDir = Join-Path $ProjectRoot "dist\monsterlock_obfuscated"

if ($Tool -eq "pyarmor") {
    & $py -m pip install -q pyarmor
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
    & $py -m pyarmor gen -O $outDir `
        (Join-Path $coreDir "engine.py") `
        (Join-Path $coreDir "crypto.py") `
        (Join-Path $coreDir "hardware.py") `
        (Join-Path $coreDir "anti_debug.py")
    Write-Host "[OK] PyArmor 輸出: $outDir" -ForegroundColor Green
} else {
    & $py -m pip install -q nuitka ordered-set zstandard
    & $py -m nuitka --module (Join-Path $coreDir "engine.py") --output-dir=$outDir
    Write-Host "[OK] Nuitka 輸出: $outDir" -ForegroundColor Green
}