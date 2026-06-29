# Monster AI — one-click GitHub upload helper
# Usage:
#   .\scripts\push-github.ps1
#   .\scripts\push-github.ps1 -RemoteUrl "https://github.com/USER/monster-ai.git"
#   .\scripts\push-github.ps1 -RemoteUrl "https://github.com/USER/monster-ai.git" -Branch main -Message "Initial commit"

param(
    [string]$RemoteUrl = "",
    [string]$Branch = "main",
    [string]$Message = "Monster AI + MonsterGuard Discord bot"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Test-GitInstalled {
    git --version | Out-Null
}

function Test-SecretsStaged {
    $staged = git diff --cached --name-only 2>$null
    $blocked = @(
        "discord.token.local",
        ".env",
        "config.yaml",
        ".jks",
        "keystore.properties"
    )
    $blockedPatterns = @(
        "terminals/",
        ".gradle/",
        "node_modules/"
    )
    foreach ($name in $staged) {
        foreach ($b in $blocked) {
            if ($name -eq $b -or $name -like "*\$b" -or $name -like "*/*$b") {
                throw "Blocked secret file staged: $name — remove before push."
            }
        }
        foreach ($pattern in $blockedPatterns) {
            if ($name -like "*$pattern*") {
                throw "Blocked local artifact staged: $name — check .gitignore."
            }
        }
    }
}

Write-Host "Monster AI GitHub upload helper" -ForegroundColor Cyan
Write-Host "Root: $Root`n"

Test-GitInstalled

if (-not (Test-Path ".git")) {
    Write-Host "Initializing git repository..."
    git init -b $Branch
}

if (-not (Test-Path "discord.token.local.example")) {
    Write-Warning "discord.token.local.example missing — create before sharing setup docs."
}

Write-Host "Staging files (respecting .gitignore)..."
git add -A
Test-SecretsStaged

$status = git status --porcelain
if (-not $status) {
    Write-Host "Nothing to commit — working tree clean." -ForegroundColor Yellow
} else {
    git commit -m $Message
    Write-Host "Committed." -ForegroundColor Green
}

if ($RemoteUrl) {
    $existing = git remote get-url origin 2>$null
    if ($LASTEXITCODE -ne 0) {
        git remote add origin $RemoteUrl
        Write-Host "Added remote: $RemoteUrl"
    } elseif ($existing -ne $RemoteUrl) {
        git remote set-url origin $RemoteUrl
        Write-Host "Updated remote: $RemoteUrl"
    }
    Write-Host "Pushing to origin/$Branch ..."
    git push -u origin $Branch
    Write-Host "Done! Repository: $RemoteUrl" -ForegroundColor Green
} else {
    Write-Host @"

Next steps:
  1. Create a new repo on GitHub (empty, no README)
  2. Run:
     .\scripts\push-github.ps1 -RemoteUrl "https://github.com/YOUR_USER/YOUR_REPO.git"

Or with SSH:
     .\scripts\push-github.ps1 -RemoteUrl "git@github.com:YOUR_USER/YOUR_REPO.git"

"@ -ForegroundColor Yellow
}