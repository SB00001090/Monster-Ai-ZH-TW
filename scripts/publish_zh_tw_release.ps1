# Publish release to Guardian-Ai-ZH-TW
$ErrorActionPreference = "Stop"
$credInput = "protocol=https`nhost=github.com`n`n"
$credOutput = $credInput | git credential fill 2>$null
$token = ($credOutput | Select-String "password=(.+)").Matches.Groups[1].Value
if (-not $token) { throw "GitHub token not found in git credential" }

$headers = @{
    Authorization = "Bearer $token"
    Accept = "application/vnd.github+json"
    "X-GitHub-Api-Version" = "2022-11-28"
}

$releaseBody = "Monster Guardian AI v1.3.1 (ZH-TW repo)`n`n- E2E cloud sync (Google/GitHub + passphrase)`n- Cloudflare Tunnel HTTPS`n- Training Vault Keystore binding`n- USB adb install + GitHub Releases`n- main includes G5 network learning (G5a/b/c)`n- Developed by Suckbob | Monster Guardian AI"

$payloadObj = [ordered]@{
    tag_name = "v1.3.1"
    target_commitish = "main"
    name = "Monster Guardian AI v1.3.1 ZH-TW"
    body = $releaseBody
    draft = $false
    prerelease = $false
    generate_release_notes = $false
}
$payload = $payloadObj | ConvertTo-Json

$rel = $null
try {
    $rel = Invoke-RestMethod -Uri "https://api.github.com/repos/SB00001090/Guardian-Ai-ZH-TW/releases/tags/v1.3.1" -Headers $headers
    Write-Host "Release already exists: $($rel.html_url)"
} catch {
    $rel = Invoke-RestMethod -Uri "https://api.github.com/repos/SB00001090/Guardian-Ai-ZH-TW/releases" -Method Post -Headers $headers -Body $payload -ContentType "application/json"
    Write-Host "Created release: $($rel.html_url)"
}

$apkUrl = "https://github.com/SB00001090/Monster-Ai/releases/download/v1.3.1/MonsterCallGuard-v1.3.1-signed.apk"
$shaUrl = "https://github.com/SB00001090/Monster-Ai/releases/download/v1.3.1/MonsterCallGuard-v1.3.1-signed.apk.sha256"
$tmpdir = Join-Path $env:TEMP "monster-zh-tw-release"
New-Item -ItemType Directory -Force -Path $tmpdir | Out-Null
$apkPath = Join-Path $tmpdir "MonsterCallGuard-v1.3.1-signed.apk"
$shaPath = Join-Path $tmpdir "MonsterCallGuard-v1.3.1-signed.apk.sha256"

Invoke-WebRequest -Uri $apkUrl -OutFile $apkPath
Invoke-WebRequest -Uri $shaUrl -OutFile $shaPath

function Upload-Asset([string]$FilePath, [string]$Name) {
    $uploadUrl = "https://uploads.github.com/repos/SB00001090/Guardian-Ai-ZH-TW/releases/$($rel.id)/assets?name=$Name"
    $uploadHeaders = @{
        Authorization = "Bearer $token"
        Accept = "application/vnd.github+json"
    }
    $bytes = [System.IO.File]::ReadAllBytes($FilePath)
    Invoke-RestMethod -Uri $uploadUrl -Method Post -Headers $uploadHeaders -Body $bytes -ContentType "application/octet-stream" | Out-Null
    Write-Host "Uploaded asset: $Name"
}

$assetNames = @()
if ($rel.assets) { $assetNames = @($rel.assets | ForEach-Object { $_.name }) }
if ($assetNames -notcontains "MonsterCallGuard-v1.3.1-signed.apk") {
    Upload-Asset $apkPath "MonsterCallGuard-v1.3.1-signed.apk"
}
if ($assetNames -notcontains "MonsterCallGuard-v1.3.1-signed.apk.sha256") {
    Upload-Asset $shaPath "MonsterCallGuard-v1.3.1-signed.apk.sha256"
}

Write-Host "Done."