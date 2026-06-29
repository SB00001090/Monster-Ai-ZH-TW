@echo off
setlocal
cd /d "%~dp0.."
set PY=%CD%\.venv\Scripts\python.exe

echo Monster AI — download style checkpoints from Hugging Face
echo   Anime: gsdf/Counterfeit-V3.0_fp16.safetensors
echo   SD1.5: runwayml/stable-diffusion-v1-5
echo.

if not exist "%PY%" (
  echo Run run.bat once to create .venv
  exit /b 1
)

"%PY%" scripts\download_models.py
if errorlevel 1 exit /b 1

echo.
echo Done. Restart run.bat then refresh Generate tab (Ctrl+F5).
endlocal