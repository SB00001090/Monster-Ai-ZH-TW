# MonsterCallGuard API 測試
param([string]$ProjectRoot = "", [string]$BaseUrl = "http://127.0.0.1:7860")

if (-not $ProjectRoot) {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}
$py = Join-Path $ProjectRoot ".venv\Scripts\python.exe"

Write-Host "=== CallGuard API 測試 ===" -ForegroundColor Cyan

Write-Host "`n[1] 單元測試" -ForegroundColor Yellow
& $py -m pytest (Join-Path $ProjectRoot "tests\test_callguard.py") (Join-Path $ProjectRoot "tests\test_hardware_probe.py") -q

Write-Host "`n[2] 模擬收數來電" -ForegroundColor Yellow
& $py -c @"
import sys
sys.path.insert(0, r'$ProjectRoot')
from monster_ai.protection.callguard.rules import score_call
r = score_call('+85291234567', display_name='財務公司收數追債')
print(f'  score={r.score} reject={r.reject} category={r.category}')
"@

Write-Host "`n[3] HTTP API" -ForegroundColor Yellow
try {
    $body = @{ number = '+85291234567'; display_name = '收數公司'; deep = $false } | ConvertTo-Json
    $r = Invoke-RestMethod -Uri "$BaseUrl/api/callguard/analyze" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 5
    Write-Host "  API score=$($r.score) reject=$($r.reject)"
} catch {
    Write-Host "  服務未運行 — 略過 HTTP 測試" -ForegroundColor DarkYellow
}

Write-Host "`n=== 完成 ===" -ForegroundColor Green