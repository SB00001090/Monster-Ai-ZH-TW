@echo off
cd /d "%~dp0\.."
echo.
echo Monster AI Windows Service (MonsterAIService) - port 7860
echo.

sc query MonsterAIService >nul 2>&1
if errorlevel 1 (
    echo Service MonsterAIService is not installed. Port 7860 may still be free.
    goto :done_ok
)

sc query MonsterAIService | findstr /C:"STOPPED" >nul 2>&1
if not errorlevel 1 (
    echo Service is already STOPPED. Port 7860 should be free.
    goto :done_ok
)

echo Stopping service...
net stop MonsterAIService >nul 2>&1

sc query MonsterAIService | findstr /C:"STOPPED" >nul 2>&1
if not errorlevel 1 (
    goto :done_ok
)

echo.
echo Could not stop service. Right-click this file -^> Run as administrator
echo Or Admin PowerShell:  net stop MonsterAIService
pause
exit /b 1

:done_ok
echo.
echo You can now run run.bat for the React Web UI at http://127.0.0.1:7860
pause
exit /b 0