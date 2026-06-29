$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$py = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$script = Join-Path $PSScriptRoot "update_hk_rules.py"
$taskName = "MonsterAI-CrimeGuard-DailyUpdate"

$action = New-ScheduledTaskAction -Execute $py -Argument "`"$script`"" -WorkingDirectory $ProjectRoot
$trigger = New-ScheduledTaskTrigger -Daily -At "04:00"
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Force | Out-Null
Write-Host "[OK] 排程: $taskName (每日 04:00)" -ForegroundColor Green