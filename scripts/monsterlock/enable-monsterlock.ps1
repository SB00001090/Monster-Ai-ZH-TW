# 啟用 MonsterLock v2 強化模式
param(
    [string]$ProjectRoot = "",
    [ValidateSet("light", "standard", "strict")]
    [string]$Strength = "strict",
    [switch]$Hardened,
    [switch]$SelfDestruct
)

$ErrorActionPreference = "Stop"
if (-not $ProjectRoot) {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

$configPath = Join-Path $ProjectRoot "config.yaml"
if (-not (Test-Path $configPath)) {
    Copy-Item (Join-Path $ProjectRoot "config.example.yaml") $configPath
}

$py = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $py)) { $py = "python" }

$isHardened = $Hardened -or $Strength -eq "strict"
$selfDestructVal = if ($SelfDestruct -or $isHardened) { "true" } else { "false" }
$hardenedVal = if ($isHardened) { "true" } else { "false" }

$patchScript = @"
import yaml
from pathlib import Path
p = Path(r'$configPath')
data = yaml.safe_load(p.read_text(encoding='utf-8')) or {}
prot = data.setdefault('protection', {})
ml = prot.setdefault('monsterlock', {})
ml.update({
    'enabled': True,
    'strength': '$Strength',
    'hardened_mode': $hardenedVal,
    'hardware_binding': True,
    'bind_gpu': True,
    'auto_bind_on_first_run': True,
    'block_on_mismatch': True,
    'integrity_check_enabled': True,
    'digital_signatures_enabled': True,
    'check_interval_seconds': 30,
    'auto_repair': True,
    'block_on_tamper': True,
    'anti_debug_enabled': True,
    'block_on_analysis': $hardenedVal,
    'behavior_monitor_enabled': True,
    'credential_rotation_enabled': True,
    'credential_rotation_seconds': 0.1,
    'config_guard_enabled': $hardenedVal,
    'self_destruct_enabled': $selfDestructVal,
    'self_destruct_on_tamper': $selfDestructVal,
    'self_destruct_on_analysis': $hardenedVal,
    'corrupt_assets_on_destruct': True,
    'force_exit_on_destruct': False,
    'data_dir': './data/monsterlock',
})
p.write_text(yaml.dump(data, allow_unicode=True, default_flow_style=False), encoding='utf-8')
print('MonsterLock v2 enabled:', ml['strength'], 'hardened=', ml['hardened_mode'])
"@

& $py -c $patchScript

# 建立 config seal
& $py -c @"
import sys
sys.path.insert(0, r'$ProjectRoot')
from pathlib import Path
from monster_ai.protection.monsterlock.config_guard import create_config_seal
create_config_seal(Path(r'$configPath'), Path(r'$ProjectRoot/data/monsterlock'))
"@

Write-Host "[OK] MonsterLock v2 已啟用 (強度: $Strength, 強化: $isHardened)" -ForegroundColor Green