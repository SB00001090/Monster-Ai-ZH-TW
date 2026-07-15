@echo off
REM Guardian Ai - desktop shortcut (auto-start + optional verify)
cd /d "%~dp0"
call scripts\guardian\auto_start.bat %*