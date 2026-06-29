# 註冊 Windows 每日威脅更新排程
$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$py = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$script = Join-Path $PSScriptRoot "update_threat_rules.py"
$taskName = "MonsterAI-MonsterLock-DailyUpdate"

$action = New-ScheduledTaskAction -Execute $py -Argument "`"$script`"" -WorkingDirectory $ProjectRoot
$trigger = New-ScheduledTaskTrigger -Daily -At "03:30"
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Write-Host "[OK] 已註冊排程: $taskName (每日 03:30)" -ForegroundColor Green