# Monster AI NSSM service installer
# Run as Administrator: powershell -ExecutionPolicy Bypass -File scripts\windows\install-service.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$NssmDir = Join-Path $Root "tools\nssm"
$NssmExe = Join-Path $NssmDir "nssm.exe"
$Python = Join-Path $Root ".venv\Scripts\python.exe"
$Supervisor = Join-Path $Root "scripts\windows\service-supervisor.py"
$ServiceName = "MonsterAIService"

function Ensure-Nssm {
    if (Test-Path $NssmExe) {
        Write-Host "NSSM found: $NssmExe"
        return
    }
    New-Item -ItemType Directory -Force -Path $NssmDir | Out-Null

    Write-Host "Trying winget install NSSM..."
    try {
        winget install NSSM.NSSM --accept-package-agreements --accept-source-agreements --silent 2>$null
        $wingetNssm = "${env:ProgramFiles}\NSSM\nssm.exe"
        if (Test-Path $wingetNssm) {
            Copy-Item $wingetNssm $NssmExe -Force
            Write-Host "NSSM installed via winget"
            return
        }
    } catch {
        Write-Host "winget failed: $_"
    }

    $zip = Join-Path $env:TEMP "nssm-2.24.zip"
    $urls = @(
        "https://nssm.cc/release/nssm-2.24.zip",
        "http://nssm.cc/release/nssm-2.24.zip"
    )
    foreach ($url in $urls) {
        Write-Host "Downloading NSSM from $url ..."
        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing -TimeoutSec 120
            if ((Get-Item $zip).Length -gt 100000) {
                Expand-Archive -Path $zip -DestinationPath (Join-Path $env:TEMP "nssm-extract") -Force
                $src = Join-Path $env:TEMP "nssm-extract\nssm-2.24\win64\nssm.exe"
                if (Test-Path $src) {
                    Copy-Item $src $NssmExe -Force
                    Write-Host "NSSM downloaded OK"
                    return
                }
            }
        } catch {
            Write-Host "Download failed ($url): $_"
        }
    }
    throw "Cannot get NSSM. nssm.cc may return 503 in browser. Run: winget install NSSM.NSSM"
}

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: Run PowerShell as Administrator"
    exit 1
}

if (-not (Test-Path $Python)) {
    Write-Host "ERROR: Missing $Python - run scripts\install_modules.bat first"
    exit 1
}

Ensure-Nssm

$existing = Get-Service $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Removing existing service..."
    & $NssmExe stop $ServiceName 2>$null
    Start-Sleep -Seconds 2
    & $NssmExe remove $ServiceName confirm
}

Write-Host "Installing $ServiceName ..."
& $NssmExe install $ServiceName $Python $Supervisor
& $NssmExe set $ServiceName AppDirectory $Root
& $NssmExe set $ServiceName DisplayName "Monster AI Service"
& $NssmExe set $ServiceName Description "Monster AI + Ollama + ComfyUI + MonsterGuard"
& $NssmExe set $ServiceName Start SERVICE_AUTO_START
& $NssmExe set $ServiceName AppStdout (Join-Path $Root "data\logs\service-stdout.log")
& $NssmExe set $ServiceName AppStderr (Join-Path $Root "data\logs\service-stderr.log")
& $NssmExe set $ServiceName AppRotateFiles 1
& $NssmExe set $ServiceName AppRotateBytes 10485760
& $NssmExe set $ServiceName AppExit Default Restart
& $NssmExe set $ServiceName AppRestartDelay 5000
$gpuProfile = if ($env:MONSTER_GPU_PROFILE) { $env:MONSTER_GPU_PROFILE } else { "rtx_4060" }
& $NssmExe set $ServiceName AppEnvironmentExtra "MONSTER_GPU_PROFILE=$gpuProfile"

$tokenFile = Join-Path $Root "discord.token.local"
if (Test-Path $tokenFile) {
    $tokenLine = Get-Content $tokenFile -Encoding UTF8 |
        Where-Object { $_.Trim() -and -not $_.Trim().StartsWith("#") } |
        Select-Object -First 1
    if ($tokenLine) {
        & $NssmExe set $ServiceName AppEnvironmentExtra "+MONSTER_DISCORD_TOKEN=$tokenLine"
        Write-Host "Discord token injected into service environment"
    }
}

Write-Host "Starting service..."
& $NssmExe start $ServiceName
Start-Sleep -Seconds 5
Get-Service $ServiceName
Write-Host "Done. Check: http://127.0.0.1:7860/health"
Write-Host "Logs: $Root\data\logs\supervisor.log"