@echo off
cd /d "%~dp0.."
python -c "from pathlib import Path; import sys; sys.path.insert(0,'scripts'); from detect_comfyui import find_comfyui; from comfyui_headless import start_comfyui_headless, comfyui_display_name; p=find_comfyui(); assert p, 'ComfyUI not found'; start_comfyui_headless(p); print('Started', comfyui_display_name(p), '- no window')"
pause