@echo off
REM Guardian Ai — USB ADB diagnostics
REM Developed by Suckbob | Guardian Ai
set ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe
if not exist "%ADB%" set ADB=adb
echo [Guardian Ai] adb: %ADB%
"%ADB%" devices
echo.
echo [Guardian Ai] reverse list:
"%ADB%" reverse --list
echo.
echo [Guardian Ai] If empty: "%ADB%" reverse tcp:7860 tcp:7860
pause