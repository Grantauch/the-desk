@echo off
REM publish.bat - commits and pushes whatever has changed on the site.
REM Double-click to run. Safe to run as many times as you like.
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

git add .
git commit -m "update the desk"
git push

echo.
echo Done. Changes live at https://grant-desk.com in about a minute.
echo.
pause
