@echo off
cd /d "%~dp0\.."
python -m venv .venv
call .venv\Scripts\activate.bat
pip install -r requirements.txt
pip install -r requirements-dev.txt
echo Setup complete.
pause