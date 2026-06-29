@echo off
cd /d "%~dp0\.."
if not exist .venv (
    python -m venv .venv
)
call .venv\Scripts\activate.bat
python scripts\install_modules.py %*
pause