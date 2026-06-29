# CrimeGuard 動態防火牆鎖定 / 恢復
param(
    [ValidateSet("lock", "unlock")]
    [string]$Action = "lock",
    [ValidateSet("localhost_only", "block_vpn_ports")]
    [string]$Mode = "localhost_only",
    [string]$AllowLocalServices = "true",
    [string]$ConfirmToken = ""
)

$ErrorActionPreference = "Stop"
$Prefix = "MonsterAI-CrimeGuard"

function Test-IsAdmin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p = New-Object Security.Principal.WindowsPrincipal $id
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Remove-CrimeGuardRules {
    netsh advfirewall firewall show rule name=all | Select-String $Prefix | ForEach-Object {
        if ($_ -match "Rule Name:\s+(MonsterAI-CrimeGuard[^\r\n]+)") {
            netsh advfirewall firewall delete rule name="$($Matches[1].Trim())" | Out-Null
        }
    }
    Get-NetFirewallRule -DisplayName "$Prefix*" -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue
}

function Add-LocalhostAllowRules {
    $locals = @("127.0.0.1", "::1")
    foreach ($ip in $locals) {
        $name = "$Prefix-Allow-Local-$ip"
        New-NetFirewallRule -DisplayName $name -Direction Outbound -Action Allow -RemoteAddress $ip -Profile Any -ErrorAction SilentlyContinue | Out-Null
        Write-Output "RULE:$name"
    }
    if ($AllowLocalServices -eq "true") {
        $ollama = "$Prefix-Allow-Ollama"
        New-NetFirewallRule -DisplayName $ollama -Direction Outbound -Action Allow -RemoteAddress 127.0.0.1 -RemotePort 11434 -Protocol TCP -Profile Any -ErrorAction SilentlyContinue | Out-Null
        Write-Output "RULE:$ollama"
        $comfy = "$Prefix-Allow-ComfyUI"
        New-NetFirewallRule -DisplayName $comfy -Direction Outbound -Action Allow -RemoteAddress 127.0.0.1 -RemotePort 8188 -Protocol TCP -Profile Any -ErrorAction SilentlyContinue | Out-Null
        Write-Output "RULE:$comfy"
    }
}

function Lock-Network {
    if (-not (Test-IsAdmin)) {
        Write-Error "需要以系統管理員身分執行"
        exit 2
    }
    Remove-CrimeGuardRules
    Add-LocalhostAllowRules

    if ($Mode -eq "localhost_only") {
        $block = "$Prefix-Block-All-Outbound"
        New-NetFirewallRule -DisplayName $block -Direction Outbound -Action Block -RemoteAddress Any -Profile Any -ErrorAction SilentlyContinue | Out-Null
        Write-Output "RULE:$block"
    } else {
        $ports = @(1194, 443, 4500, 51820, 1701, 500, 4500)
        foreach ($p in $ports) {
            $name = "$Prefix-Block-VPN-Port-$p"
            New-NetFirewallRule -DisplayName $name -Direction Outbound -Action Block -Protocol UDP -RemotePort $p -Profile Any -ErrorAction SilentlyContinue | Out-Null
            New-NetFirewallRule -DisplayName "$name-TCP" -Direction Outbound -Action Block -Protocol TCP -RemotePort $p -Profile Any -ErrorAction SilentlyContinue | Out-Null
            Write-Output "RULE:$name"
        }
    }
    Write-Output "LOCKED:$Mode"
}

function Unlock-Network {
    if (-not (Test-IsAdmin)) {
        Write-Error "需要以系統管理員身分執行"
        exit 2
    }
    if (-not $ConfirmToken) {
        Write-Error "需要 ConfirmToken"
        exit 3
    }
    Remove-CrimeGuardRules
    Write-Output "UNLOCKED"
}

switch ($Action) {
    "lock" { Lock-Network }
    "unlock" { Unlock-Network }
}