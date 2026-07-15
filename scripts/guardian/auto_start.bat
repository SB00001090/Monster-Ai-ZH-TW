@echo off
REM Guardian Ai - one-click auto-start (backend + tunnel + verify)
REM Developed by Suckbob | Guardian Ai
cd /d "%~dp0..\.."
echo.
echo === Guardian Ai Auto-Start ===
echo.

if exist .venv\Scripts\python.exe (
    set PY=.venv\Scripts\python.exe
) else if exist C:\Users\tm072\AppData\Local\Programs\Python\Python311\python.exe (
    set PY=C:\Users\tm072\AppData\Local\Programs\Python\Python311\python.exe
) else (
    set PY=python
)

"%PY%" scripts\guardian\auto_start.py %*
set EC=%ERRORLEVEL%
if %EC% neq 0 (
    echo.
    echo [FAIL] auto_start exit code %EC%
    pause
    exit /b %EC%
)
echo.
echo Tunnel URL saved to data\guardian-ai\tunnel_url.txt
type data\guardian-ai\tunnel_url.txt 2>nul
echo.
pause
exit /b 0