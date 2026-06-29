@echo off
echo Stopping all Monster AI instances on port 7860...
echo (If access denied, right-click this file and choose "Run as administrator")
echo.

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":7860" ^| findstr LISTENING') do (
    echo Kill port 7860 PID %%a
    taskkill /PID %%a /F
)

for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq python.exe" /FO LIST ^| findstr "PID:"') do (
    wmic process where "ProcessId=%%a" get CommandLine 2>nul | findstr /I "monster-ai main.py launch_monsterguard" >nul
    if not errorlevel 1 (
        echo Kill python PID %%a
        taskkill /PID %%a /F
    )
)

timeout /t 2 /nobreak >nul
netstat -ano | findstr ":7860" | findstr LISTENING
if errorlevel 1 (
    echo Port 7860 is free.
) else (
    echo WARNING: Port 7860 still in use. Run this script as Administrator.
)
echo Done. Now run ONLY ONE: run-monsterguard.bat
pause