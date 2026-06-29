@echo off
setlocal
cd /d "%~dp0.."
set PY=%CD%\.venv\Scripts\python.exe

echo Monster AI — train generation (anti-collapse LoRA)
echo Video training materials: C:\MonsterAI\Training generative video
echo.

if not exist "%PY%" (
  echo Virtual env missing. Run run.bat once to create .venv
  exit /b 1
)

echo [1/3] Export training manifest...
"%PY%" scripts\export_training_dataset.py
if errorlevel 1 exit /b 1

echo [2/3] Import outputs + prepare dataset...
"%PY%" scripts\train_image_quality_4060.py --scan-outputs --mode prepare_only
if errorlevel 1 exit /b 1

"%PY%" -c "import torch, diffusers, peft" >nul 2>&1
if errorlevel 1 (
  echo Training deps missing. Installing torch + train stack...
  "%PY%" scripts\install_modules.py --with-train --upgrade
  if errorlevel 1 exit /b 1
)

echo [3/3] Training LoRA (RTX 4060 low-vram)...
"%PY%" scripts\train_image_quality_4060.py --scan-outputs --low-vram --deploy
if errorlevel 1 exit /b 1

echo.
echo Done. LoRA deployed to ComfyUI\models\loras\anti_collapse.safetensors
echo Select it in Generate tab (auto-selected if listed).
endlocal