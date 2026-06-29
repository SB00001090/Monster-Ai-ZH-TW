@echo off
setlocal
echo Monster AI — ffmpeg setup for video (.mp4)
echo.

where ffmpeg >nul 2>&1
if not errorlevel 1 (
  ffmpeg -version | findstr /i "ffmpeg version"
  echo ffmpeg already on PATH.
  exit /b 0
)

echo ffmpeg not found. Installing via winget...
winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements
if errorlevel 1 (
  echo.
  echo Manual install: https://ffmpeg.org/download.html
  echo Add ffmpeg\bin to your PATH, then restart run.bat
  exit /b 1
)

echo.
echo ffmpeg installed. Close this window and restart run.bat so PATH updates.
endlocal