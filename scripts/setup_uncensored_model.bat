@echo off
setlocal
cd /d "%~dp0.."

echo Monster AI — uncensored local LLM setup
echo.
echo This pulls a model suitable for Grok-style uncensored chat.
echo Ollama must be running: ollama serve
echo.

where ollama >nul 2>&1
if errorlevel 1 (
  echo ERROR: ollama not found on PATH. Install from https://ollama.com
  exit /b 1
)

set MODEL=llama3.2:latest
if not "%MONSTER_LLM_MODEL%"=="" set MODEL=%MONSTER_LLM_MODEL%

echo Pulling %MODEL% ...
ollama pull %MODEL%
if errorlevel 1 exit /b 1

echo.
echo Done. Set config.yaml:
echo   llm.model: "%MODEL%"
echo   persona.default_mode: grok
echo.
echo Restart Monster AI with run.bat
endlocal