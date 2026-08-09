@echo off
REM publish.bat - validates, commits, and publishes the current batch of site changes.
REM Netlify charges credits for each production publish, so use this only when a batch is ready.
cd /d "%~dp0"

if exist ".git\index.lock" del /f ".git\index.lock"

set PROBLEM=0
if not exist "public\hubs\jeopardy-hidden-history-unit1.html" set PROBLEM=1
if not exist "public\hubs\jeopardy-scoreboard-unit1.html" set PROBLEM=1
if %PROBLEM%==1 (
  echo.
  echo STOP: the two new jeopardy board files are not in public\hubs yet.
  echo In the Claude chat, click each jeopardy card, choose Save,
  echo and put them in:  %~dp0public\hubs
  echo Then double-click this file again.
  echo.
  pause
  exit /b 1
)

if not exist "public\og-us-history.png" echo NOTE: og image files missing from public\ - social previews will use the default card. Not a dealbreaker, continuing...

echo.
echo Checking the site locally before publishing...
call npm.cmd run build
if errorlevel 1 (
  echo.
  echo STOP: the site did not build successfully. Nothing was published.
  echo.
  pause
  exit /b 1
)

git status --short
echo.
echo Ready to publish this batch to grant-desk.com.
echo Netlify currently counts this as one production deployment (15 credits).
choice /C YN /N /M "Publish now? [Y/N] "
if errorlevel 2 (
  echo.
  echo Cancelled. Your changes are still saved on this computer.
  echo.
  pause
  exit /b 0
)

git add .
git commit -m "update the desk"
if errorlevel 1 (
  echo.
  echo Nothing new to publish. No Netlify deployment was triggered.
  echo.
  pause
  exit /b 0
)
git push
if errorlevel 1 (
  echo.
  echo The upload did not finish. Your commit is safe on this computer.
  echo.
  pause
  exit /b 1
)

echo.
echo Done. Netlify should update https://grant-desk.com in about a minute.
echo.
pause
