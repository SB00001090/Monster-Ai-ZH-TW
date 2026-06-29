@echo off
cd /d "%~dp0\.."
echo Stopping Monster AI (ports 3000-3005, 5173, 7860)...
echo.
echo If :7860 shows OLD MonsterLock HTML, port 7860 may be held by Windows Service.
echo Run scripts\stop-service.bat as Administrator, then run run.bat again.
echo.
net stop MonsterAIService >nul 2>&1

for %%P in (3000 3001 3002 3003 3004 3005 5173 7860 5174 5175) do (
    for /f "tokens=5" %%A in ('netstat -ano ^| findstr ":%%P " ^| findstr LISTENING') do (
        if not "%%A"=="0" (
            echo Killing PID %%A on port %%P
            taskkill /PID %%A /F >nul 2>&1
        )
    )
)

echo Done. You can run run.bat again.
pause