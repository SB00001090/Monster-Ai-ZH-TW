@echo off
cd /d "%~dp0"

if not exist .venv (
    echo Creating virtual environment...
    python -m venv .venv
    if errorlevel 1 (
        echo Failed to create venv. Install Python 3.11+ and try again.
        pause
        exit /b 1
    )
)

call .venv\Scripts\activate.bat
pip install -r requirements.txt -q

if not exist .env (
    if exist .env.example (
        copy .env.example .env >nul
        echo Created .env from .env.example
    )
)

echo.
echo Monster AI - One-Click Web UI
echo.
echo   React UI + Python API : http://127.0.0.1:7860
echo   ComfyUI (optional)    : http://127.0.0.1:8188
echo.
echo Node.js + pnpm required for full React UI (install if prompted).
echo UI source: client\  (monsterai\ folder is reference only, not used here)
echo If you see OLD MonsterLock HTML, run scripts\stop-service.bat as Admin first.
echo If port 3000/7860 busy, run scripts\stop-dev.bat then run run.bat again.
echo Keep this window open.
echo.

python scripts\launcher.py
pause