# 匯出威脅庫 JSON 供 CDN / App 同步
param([string]$ProjectRoot = "")

if (-not $ProjectRoot) {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}
$py = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$outDir = Join-Path $ProjectRoot "dist"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

& $py -c @"
import json, sys
from pathlib import Path
sys.path.insert(0, r'$ProjectRoot')
import yaml
from monster_ai.protection.callguard.rules import load_threat_db
src = Path(r'$ProjectRoot') / 'data' / 'callguard' / 'threat_db.yaml'
db = load_threat_db(src)
out = Path(r'$outDir') / 'threat_db.json'
out.write_text(json.dumps(db, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'Published: {out} version={db.get(\"version\")}')
"@