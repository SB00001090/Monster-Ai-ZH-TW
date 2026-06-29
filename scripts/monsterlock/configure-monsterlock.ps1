# MonsterLock 互動式配置
param([string]$ProjectRoot = "")

$ErrorActionPreference = "Stop"
if (-not $ProjectRoot) {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

Write-Host "=== MonsterLock 配置精靈 ===" -ForegroundColor Cyan

$strength = Read-Host "保護強度 [light/standard/strict] (預設 standard)"
if (-not $strength) { $strength = "standard" }

$selfDestruct = Read-Host "啟用自毀模式? [y/N]"
$sd = $selfDestruct -match '^[Yy]'

$blockAnalysis = Read-Host "偵測到除錯器時阻擋啟動? [y/N]"
$ba = $blockAnalysis -match '^[Yy]'

$bindGpu = Read-Host "綁定 RTX GPU UUID? [Y/n]"
$gpu = -not ($bindGpu -match '^[Nn]')

$configPath = Join-Path $ProjectRoot "config.yaml"
$py = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $py)) { $py = "python" }

$patch = @"
import yaml
from pathlib import Path
p = Path(r'$configPath')
data = yaml.safe_load(p.read_text(encoding='utf-8')) or {}
ml = data.setdefault('protection', {}).setdefault('monsterlock', {})
ml['enabled'] = True
ml['strength'] = '$strength'
ml['self_destruct_enabled'] = $($sd.ToString().ToLower())
ml['block_on_analysis'] = $($ba.ToString().ToLower())
ml['bind_gpu'] = $($gpu.ToString().ToLower())
p.write_text(yaml.dump(data, allow_unicode=True, default_flow_style=False), encoding='utf-8')
"@

& $py -c $patch

Write-Host ""
Write-Host "目前硬體指紋:" -ForegroundColor Yellow
& $py (Join-Path $PSScriptRoot "bind_hardware.py") --show-only

Write-Host ""
Write-Host "[OK] 配置已儲存至 config.yaml" -ForegroundColor Green