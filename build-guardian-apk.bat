@echo off
REM Guardian Ai - build release APK to dist\
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\guardian\build_apk.ps1
if errorlevel 1 pause
exit /b %ERRORLEVEL%