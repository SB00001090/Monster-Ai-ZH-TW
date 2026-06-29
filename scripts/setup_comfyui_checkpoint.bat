@echo off
set CKPT_DIR=C:\MonsterAI\comfyui\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable\ComfyUI\models\checkpoints
echo Monster AI - ComfyUI checkpoint setup
echo.
echo Target folder:
echo   %CKPT_DIR%
echo.
if not exist "%CKPT_DIR%" (
    echo Folder not found. Edit CKPT_DIR in this script for your ComfyUI path.
    pause
    exit /b 1
)
echo Download SD 1.5 checkpoint (~4GB) from HuggingFace...
echo This may take several minutes.
echo.
pip install huggingface_hub -q
python -c "from huggingface_hub import hf_hub_download; import shutil; p=hf_hub_download('runwayml/stable-diffusion-v1-5','v1-5-pruned-emaonly.safetensors'); shutil.copy(p, r'%CKPT_DIR%\v1-5-pruned-emaonly.safetensors'); print('Done:', r'%CKPT_DIR%\v1-5-pruned-emaonly.safetensors')"
echo.
echo Restart ComfyUI, then retry image/video generation in Monster AI.
pause