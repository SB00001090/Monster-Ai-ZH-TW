# CrimeGuard USB / Bluetooth escalation lock
param(
    [ValidateSet("lock", "unlock")]
    [string]$Action = "lock",
    [string]$LockUsb = "true",
    [string]$LockBluetooth = "true"
)

$ErrorActionPreference = "Stop"
$UsbRegPath = "HKLM:\SYSTEM\CurrentControlSet\Services\USBSTOR"
$BtRegPath = "HKLM:\SYSTEM\CurrentControlSet\Services\BTHPORT\Parameters"

function Test-IsAdmin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p = New-Object Security.Principal.WindowsPrincipal $id
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Lock-Devices {
    if (-not (Test-IsAdmin)) {
        Write-Error "需要以系統管理員身分執行"
        exit 2
    }
    if ($LockUsb -eq "true") {
        if (-not (Test-Path $UsbRegPath)) {
            New-Item -Path $UsbRegPath -Force | Out-Null
        }
        Set-ItemProperty -Path $UsbRegPath -Name "Start" -Value 4 -Type DWord -Force
        Write-Output "ACTION:usb_storage_disabled"
    }
    if ($LockBluetooth -eq "true") {
        Get-PnpDevice -Class Bluetooth -ErrorAction SilentlyContinue |
            Where-Object { $_.Status -eq 'OK' } |
            ForEach-Object {
                Disable-PnpDevice -InstanceId $_.InstanceId -Confirm:$false -ErrorAction SilentlyContinue
                Write-Output ("ACTION:bt_disabled:" + $_.FriendlyName)
            }
    }
    Write-Output "DEVICE_LOCKED"
}

function Unlock-Devices {
    if (-not (Test-IsAdmin)) {
        Write-Error "需要以系統管理員身分執行"
        exit 2
    }
    if (Test-Path $UsbRegPath) {
        Set-ItemProperty -Path $UsbRegPath -Name "Start" -Value 3 -Type DWord -Force -ErrorAction SilentlyContinue
        Write-Output "ACTION:usb_storage_enabled"
    }
    Get-PnpDevice -Class Bluetooth -ErrorAction SilentlyContinue |
        ForEach-Object {
            Enable-PnpDevice -InstanceId $_.InstanceId -Confirm:$false -ErrorAction SilentlyContinue
            Write-Output ("ACTION:bt_enabled:" + $_.FriendlyName)
        }
    Write-Output "DEVICE_UNLOCKED"
}

switch ($Action) {
    "lock" { Lock-Devices }
    "unlock" { Unlock-Devices }
}