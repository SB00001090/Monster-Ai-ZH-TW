@echo off
REM Guardian Ai - Play Store AAB (requires release keystore)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\guardian\build_aab.ps1
exit /b %ERRORLEVEL%