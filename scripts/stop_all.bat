@echo off
echo Stopping Monster AI Python processes on port 7860...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :7860 ^| findstr LISTENING') do taskkill /PID %%a /F 2>nul
echo Done. ComfyUI may still run in its own window — close it manually.
pause