# 讓 V Max Pro / MonsterCallGuard 透過區網連到家中 Monster AI
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Bridge = Join-Path $Root "scripts\callguard\lan-bridge.py"
Write-Host "啟動 LAN bridge: http://192.168.0.4:7860 -> http://127.0.0.1:7860"
python $Bridge