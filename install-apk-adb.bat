@echo off
REM Guardian Ai - USB install APK + adb reverse
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\guardian\install-apk-adb.ps1
if errorlevel 1 pause
exit /b %ERRORLEVEL%