# MonsterGuard always-on: Windows service auto-start + clear port conflicts
# Run as Administrator:
#   powershell -ExecutionPolicy Bypass -File scripts\windows\enable-always-on.ps1

param(
    [switch]$SkipLanBridge,
    [switch]$SkipServiceInstall
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$ServiceName = "MonsterAIService"
$Python = Join-Path $Root ".venv\Scripts\python.exe"
$InstallScript = Join-Path $Root "scripts\windows\install-service.ps1"
$LanBridge = Join-Path $Root "scripts\callguard\lan-bridge.py"

function Test-Admin {
    ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
    ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Stop-PortListeners([int]$Port) {
    $lines = netstat -ano | Select-String ":$Port\s" | Select-String "LISTENING"
    foreach ($line in $lines) {
        $pid = ($line -split "\s+")[-1]
        if ($pid -match '^\d+$') {
            Write-Host "Stopping PID $pid on port $Port"
            taskkill /PID $pid /F 2>$null | Out-Null
        }
    }
}

function Wait-GuardOnline([int]$Seconds = 90) {
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $resp = Invoke-RestMethod "http://127.0.0.1:7860/api/guard/status" -TimeoutSec 5
            if ($resp.bot.running) {
                return $true
            }
        } catch {
            # keep waiting
        }
        Start-Sleep -Seconds 3
    }
    return $false
}

if (-not (Test-Admin)) {
    Write-Host "ERROR: Run PowerShell as Administrator" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path (Join-Path $Root "discord.token.local"))) {
    Write-Host "ERROR: Missing discord.token.local" -ForegroundColor Red
    exit 1
}

Set-Location $Root
Write-Host "==> Stop conflicting Monster AI instances on port 7860"
Stop-PortListeners 7860
Start-Sleep -Seconds 2

if (-not $SkipServiceInstall) {
    Write-Host "==> Install/update Windows service $ServiceName"
    & $InstallScript
} else {
    $svc = Get-Service $ServiceName -ErrorAction SilentlyContinue
    if (-not $svc) {
        Write-Host "ERROR: Service $ServiceName not found. Remove -SkipServiceInstall" -ForegroundColor Red
        exit 1
    }
    Restart-Service $ServiceName -Force
}

Write-Host "==> Wait for MonsterGuard bot..."
if (Wait-GuardOnline) {
    $status = Invoke-RestMethod "http://127.0.0.1:7860/api/guard/status" -TimeoutSec 5
    Write-Host "[OK] MonsterGuard online. guilds=$($status.bot.guilds)" -ForegroundColor Green
} else {
    Write-Host "[WARN] Bot not online yet. Check logs:" -ForegroundColor Yellow
    Write-Host "  data\logs\monster-ai-serve.log"
    Write-Host "  data\logs\supervisor.log"
}

if (-not $SkipLanBridge) {
    $taskName = "MonsterAI-LanBridge"
    $action = New-ScheduledTaskAction -Execute $Python -Argument "`"$LanBridge`"" -WorkingDirectory $Root
    $trigger = New-ScheduledTaskTrigger -AtLogOn
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
    Write-Host "[OK] Registered logon task: $taskName" -ForegroundColor Green
    Start-Process -FilePath $Python -ArgumentList "`"$LanBridge`"" -WorkingDirectory $Root -WindowStyle Hidden
}

Write-Host ""
Write-Host "Always-on setup complete." -ForegroundColor Cyan
Write-Host "  Service: $ServiceName (Automatic)"
Write-Host "  URL: http://127.0.0.1:7860"
Write-Host "  Status: http://127.0.0.1:7860/api/guard/status"
Write-Host ""
Write-Host "Do not run run-monsterguard.bat manually while the service is active."
Write-Host "Stop: scripts\stop-monsterguard.bat as Administrator"