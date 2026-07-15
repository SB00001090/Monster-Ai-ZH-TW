@echo off
REM Guardian Ai - status dashboard
cd /d "%~dp0"
if exist .venv\Scripts\python.exe (
    .venv\Scripts\python.exe scripts\guardian\status.py
) else (
    py -3.11 scripts\guardian\status.py 2>nul || python scripts\guardian\status.py
)
pause