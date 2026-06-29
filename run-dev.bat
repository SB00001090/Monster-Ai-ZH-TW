@echo off
cd /d "%~dp0"

echo.
echo Monster AI - Full Dev Stack
echo   Python backend :7860
echo   React + tRPC   :5173 / :3000
echo.

where pnpm.cmd >nul 2>&1
if errorlevel 1 (
    echo pnpm not found. Install Node.js and run: npm install -g pnpm
    pause
    exit /b 1
)

if not exist node_modules (
    echo Installing frontend dependencies...
    call pnpm.cmd install
    if errorlevel 1 (
        echo pnpm install failed.
        pause
        exit /b 1
    )
)

if not exist .env (
    if exist .env.example (
        copy .env.example .env >nul
        echo Created .env from .env.example
    )
)

start "Monster AI Python" cmd /k "%~dp0run.bat"
echo Waiting for Python backend to start...
timeout /t 4 /nobreak >nul

echo Starting React (:5173) + tRPC API (:3000)...
echo Keep this window open. Both [web] and [api] must appear below.
call pnpm.cmd dev