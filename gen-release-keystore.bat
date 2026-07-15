@echo off
REM Guardian Ai - Play Store release keystore
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\guardian\gen_release_keystore.ps1
exit /b %ERRORLEVEL%