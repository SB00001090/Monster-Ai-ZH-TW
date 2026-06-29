# Enable CrimeGuard in config.yaml
param([string]$ProjectRoot = "")

$ErrorActionPreference = "Stop"
if (-not $ProjectRoot) {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}
$configPath = Join-Path $ProjectRoot "config.yaml"
$py = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $py)) { $py = "python" }

$script = Join-Path $PSScriptRoot "enable_crimeguard.py"
& $py $script --config $configPath
Write-Host "[OK] CrimeGuard enabled" -ForegroundColor Green