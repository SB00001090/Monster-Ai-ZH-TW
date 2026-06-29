@echo off
cd /d "%~dp0.."

where python >nul 2>&1
if errorlevel 1 (
    echo ERROR: python not found. Install from https://www.python.org/downloads/
    pause
    exit /b 1
)

python "%~dp0launch_monsterguard.py"
set EXITCODE=%ERRORLEVEL%
if not %EXITCODE%==0 (
    echo.
    echo Startup failed. Code: %EXITCODE%
    echo Log: data\logs\monsterguard-launch.log
)
pause
exit /b %EXITCODE%