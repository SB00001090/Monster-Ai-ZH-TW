# MonsterLock 攻擊模擬測試（安全環境下驗證防護反應）
param(
    [ValidateSet("config_tamper", "integrity_tamper", "all")]
    [string]$Scenario = "all"
)

$ErrorActionPreference = "Continue"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$py = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$config = Join-Path $ProjectRoot "config.yaml"
$backup = Join-Path $ProjectRoot "data\monsterlock\attack_sim_backup"

function Restore-Config {
    if (Test-Path (Join-Path $backup "config.yaml")) {
        Copy-Item (Join-Path $backup "config.yaml") $config -Force
    }
}

New-Item -ItemType Directory -Force -Path $backup | Out-Null
if (-not (Test-Path (Join-Path $backup "config.yaml")) -and (Test-Path $config)) {
    Copy-Item $config (Join-Path $backup "config.yaml")
}

Write-Host "=== MonsterLock 攻擊模擬 ===" -ForegroundColor Cyan

if ($Scenario -in @("config_tamper", "all")) {
    Write-Host "`n[攻擊 1] 嘗試關閉 MonsterLock (config.yaml)" -ForegroundColor Yellow
    & $py -c @"
import yaml
from pathlib import Path
p = Path(r'$config')
data = yaml.safe_load(p.read_text(encoding='utf-8')) or {}
data.setdefault('protection', {}).setdefault('monsterlock', {})['enabled'] = False
p.write_text(yaml.dump(data, allow_unicode=True), encoding='utf-8')
print('Tampered: enabled=false')
"@
    & $py -c @"
from pathlib import Path
import sys
sys.path.insert(0, r'$ProjectRoot')
from monster_ai.protection.monsterlock.config_guard import verify_config_seal
ok, reason = verify_config_seal(Path(r'$config'), Path(r'$ProjectRoot/data/monsterlock'))
print('Config guard:', 'BLOCKED' if not ok else 'passed', reason)
"@
    Restore-Config
}

if ($Scenario -in @("integrity_tamper", "all")) {
    Write-Host "`n[攻擊 2] 篡改受保護檔案" -ForegroundColor Yellow
    $target = Join-Path $ProjectRoot "monster_ai\protection\firewall.py"
    $orig = Get-Content $target -Raw
    try {
        Add-Content $target "`n# attack_sim_tamper" -Encoding UTF8
        & $py -c @"
import sys
sys.path.insert(0, r'$ProjectRoot')
from pathlib import Path
from monster_ai.config import load_settings
from monster_ai.protection.monsterlock.engine import MonsterLockEngine
s = load_settings()
e = MonsterLockEngine(s.protection.monsterlock, Path(r'$ProjectRoot'))
e.settings.self_destruct_on_tamper = False
e.settings.block_on_analysis = False
e.settings.anti_debug_enabled = False
ok = e.bootstrap()
print('Bootstrap after tamper:', ok, 'integrity_ok=', e.state.last_integrity_ok)
"@
    } finally {
        Set-Content $target $orig -Encoding UTF8 -NoNewline
    }
}

Write-Host "`n=== 模擬完成（已還原 config）===" -ForegroundColor Green