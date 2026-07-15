@echo off
REM Guardian Ai - start Node tRPC API on :3000
cd /d "%~dp0"
if exist .venv\Scripts\python.exe (
    .venv\Scripts\python.exe scripts\guardian\start_node_api.py
) else (
    py -3.11 scripts\guardian\start_node_api.py 2>nul || python scripts\guardian\start_node_api.py
)
exit /b %ERRORLEVEL%