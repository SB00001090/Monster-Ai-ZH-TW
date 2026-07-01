# Sync monster-ai repo into Monster-ai Zh-Tw/ (Traditional Chinese staging folder)
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $root "Monster-ai Zh-Tw"
$zhReadme = Join-Path $dest "README.md"
$zhReadmeBackup = Join-Path $env:TEMP "monster-ai-zh-tw-readme-backup.md"

if (-not (Test-Path $zhReadme)) {
    throw "Missing $zhReadme — create Monster-ai Zh-Tw/README.md first."
}

# Preserve Traditional Chinese README across sync
Copy-Item -Force $zhReadme $zhReadmeBackup

New-Item -ItemType Directory -Force -Path $dest | Out-Null

$excludeDirs = @(
    ".git",
    "node_modules",
    ".venv",
    "data",
    "dist",
    "__pycache__",
    "Monster-ai Zh-Tw"
)

$robocopyArgs = @(
    $root,
    $dest,
    "/E",
    "/NFL",
    "/NDL",
    "/NJH",
    "/NJS",
    "/NC",
    "/NS",
    "/NP"
)
foreach ($dir in $excludeDirs) {
    $robocopyArgs += "/XD"
    $robocopyArgs += (Join-Path $root $dir)
}

Write-Host "Syncing $root -> $dest"
$rc = & robocopy @robocopyArgs
# Robocopy exit codes 0-7 are success/partial success
if ($LASTEXITCODE -ge 8) {
    throw "robocopy failed with exit code $LASTEXITCODE"
}

Copy-Item -Force $zhReadmeBackup $zhReadme
Remove-Item -Force $zhReadmeBackup -ErrorAction SilentlyContinue

Write-Host "Done. Traditional Chinese README preserved at Monster-ai Zh-Tw\README.md"