# 偵測硬體 Tier 與建議推理後端
param([string]$ProjectRoot = "")

if (-not $ProjectRoot) {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}
$py = Join-Path $ProjectRoot ".venv\Scripts\python.exe"

Write-Host "=== Monster AI Hardware Tier ===" -ForegroundColor Cyan
& $py -c @"
import sys
sys.path.insert(0, r'$ProjectRoot')
from monster_ai.core.hardware_probe import detect_hardware
from monster_ai.llm.runtime import load_inference_presets
from pathlib import Path
p = detect_hardware()
presets = load_inference_presets(Path(r'$ProjectRoot'))
tier_cfg = (presets.get('tiers') or {}).get(p.tier, {})
print(f'Tier:       {p.tier}')
print(f'RAM:        {p.ram_gb} GB')
print(f'VRAM:       {p.vram_mb} MB')
print(f'GPU:        {p.gpu_name or \"none\"}')
print(f'Backends:   {\", \".join(p.backends)}')
print(f'Model:      {tier_cfg.get(\"model\", \"rules\")}')
print(f'Protection: {tier_cfg.get(\"protection_strength\", \"standard\")}')
"@