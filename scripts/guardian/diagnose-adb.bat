@echo off
REM Guardian Ai — USB ADB diagnostics
REM Developed by Suckbob | Guardian Ai
echo [Guardian Ai] Checking adb devices...
adb devices
echo.
echo [Guardian Ai] Checking reverse port 7860...
adb reverse --list
echo.
echo [Guardian Ai] If empty, run: adb reverse tcp:7860 tcp:7860
pause