@echo off
cd /d "%~dp0"
echo MonsterGuard 永遠上線設定（需要管理員權限）
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\windows\enable-always-on.ps1"
pause