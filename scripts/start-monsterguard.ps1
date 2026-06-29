# MonsterGuard 啟動腳本 — 避免 PowerShell 環境變數語法錯誤
# 用法：在 PowerShell 執行  .\scripts\start-monsterguard.ps1

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$TokenFile = Join-Path $Root "discord.token.local"

if (Test-Path $TokenFile) {
    $token = (Get-Content $TokenFile -Raw).Trim()
    Write-Host "已從 discord.token.local 讀取 Token"
} else {
    Write-Host "請貼上 Discord Bot Token（輸入時不會顯示）："
    $secure = Read-Host -AsSecureString
    $token = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    )
}

if ([string]::IsNullOrWhiteSpace($token)) {
    Write-Host "錯誤：Token 為空。請到 Discord Developer Portal -> Bot -> Copy Token" -ForegroundColor Red
    exit 1
}

$env:MONSTER_DISCORD_TOKEN = $token
Write-Host "啟動 Monster AI + MonsterGuard（embedded 模式）..."
python main.py