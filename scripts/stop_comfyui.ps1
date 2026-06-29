# Stop ComfyUI_windows_portable_nvidia and anything on port 8188
$ErrorActionPreference = "SilentlyContinue"

foreach ($conn in Get-NetTCPConnection -LocalPort 8188) {
    $pid = $conn.OwningProcess
    if ($pid) {
        Write-Host "Stopping PID $pid (port 8188)"
        Stop-Process -Id $pid -Force
    }
}

Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
    Where-Object { $_.CommandLine -match 'ComfyUI|comfyui|run_nvidia_gpu' } |
    ForEach-Object {
        Write-Host "Stopping ComfyUI python PID $($_.ProcessId)"
        Stop-Process -Id $_.ProcessId -Force
    }

Get-CimInstance Win32_Process -Filter "Name='cmd.exe'" |
    Where-Object { $_.CommandLine -match 'run_nvidia_gpu|ComfyUI' } |
    ForEach-Object {
        Write-Host "Stopping ComfyUI cmd PID $($_.ProcessId)"
        Stop-Process -Id $_.ProcessId -Force
    }

$still = Get-NetTCPConnection -LocalPort 8188 -ErrorAction SilentlyContinue
if ($still) { Write-Host "WARNING: port 8188 still in use" } else { Write-Host "ComfyUI stopped (port 8188 free)" }