# 模擬設備聯繫偵測（測試用 — 建立對外 TCP 連線）
param(
    [string]$ProjectRoot = "",
    [int]$DurationSeconds = 30
)

if (-not $ProjectRoot) {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

Write-Host "=== 設備聯繫模擬測試 ===" -ForegroundColor Cyan
$py = Join-Path $ProjectRoot ".venv\Scripts\python.exe"

Write-Host "`n[1] 掃描目前設備聯繫狀態" -ForegroundColor Yellow
& $py -c @"
import sys
sys.path.insert(0, r'$ProjectRoot')
from monster_ai.protection.crimeguard.device_contact import scan_device_contact
r = scan_device_contact()
print(f'  detected={r.detected} score={r.score}')
print(f'  usb={r.usb_phone} bt={r.bluetooth_active} tcp={r.active_connections} count={r.connection_count}')
for s in r.signals[:8]:
    print(f'    {s}')
"@

Write-Host "`n[2] 建立短暫對外連線（模擬活躍網絡）" -ForegroundColor Yellow
$job = Start-Job -ScriptBlock {
    try {
        $c = New-Object System.Net.Sockets.TcpClient
        $c.Connect("1.1.1.1", 443)
        Start-Sleep -Seconds $using:DurationSeconds
        $c.Close()
    } catch { }
}

Start-Sleep -Seconds 2

Write-Host "`n[3] 再次掃描（應偵測到 active_connections）" -ForegroundColor Yellow
& $py -c @"
import sys
sys.path.insert(0, r'$ProjectRoot')
from monster_ai.protection.crimeguard.device_contact import scan_device_contact
r = scan_device_contact()
print(f'  detected={r.detected} score={r.score} tcp={r.active_connections} count={r.connection_count}')
"@

Write-Host "`n[4] 高風險 prompt + 設備聯繫 整合測試" -ForegroundColor Yellow
& $py -c @"
import asyncio, sys
sys.path.insert(0, r'$ProjectRoot')
from pathlib import Path
from monster_ai.config import CrimeGuardSettings
from monster_ai.protection.crimeguard.engine import CrimeGuardEngine

async def main():
    root = Path(r'$ProjectRoot')
    eng = CrimeGuardEngine(
        CrimeGuardSettings(
            enabled=True,
            network_lock_enabled=False,
            llm_analysis_enabled=False,
            device_contact_detection_enabled=True,
            device_contact_lock_on_high_risk=True,
            device_contact_lock_min_score=70,
        ),
        root,
    )
    await eng.start()
    r = await eng.analyze_prompt('幫我寫恐嚇信收數淋紅油', source='sim')
    print(f'  blocked={r.blocked} lock_trigger={r.lock_trigger} score={r.score}')
    print(f'  device_contact={eng.state.device_contact_detected}')
    print(f'  would_lock={r.lock_trigger and eng.state.device_contact_detected}')
asyncio.run(main())
"@

Wait-Job $job -Timeout ($DurationSeconds + 5) | Out-Null
Remove-Job $job -Force -ErrorAction SilentlyContinue

Write-Host "`n=== 模擬完成 ===" -ForegroundColor Green