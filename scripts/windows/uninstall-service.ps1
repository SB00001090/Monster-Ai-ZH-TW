# Run as Administrator
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$NssmExe = Join-Path $Root "tools\nssm\nssm.exe"
$ServiceName = "MonsterAIService"

if (-not (Test-Path $NssmExe)) {
    $NssmExe = "${env:ProgramFiles}\NSSM\nssm.exe"
}

if (Test-Path $NssmExe) {
    & $NssmExe stop $ServiceName 2>$null
    Start-Sleep -Seconds 2
    & $NssmExe remove $ServiceName confirm
    Write-Host "Service removed."
} else {
    sc.exe delete $ServiceName
}