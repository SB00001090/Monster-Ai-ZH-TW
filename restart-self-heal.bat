@echo off
cd /d "%~dp0"
echo ========================================
echo  Monster AI 重啟（載入自癒 / 學習 API）
echo  請確認此視窗以【系統管理員】執行
echo ========================================
echo.

call "%~dp0scripts\stop-monsterguard.bat"
timeout /t 3 /nobreak >nul
call "%~dp0run-monsterguard.bat"