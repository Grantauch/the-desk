@echo off
REM publish-games.bat - commits and pushes the games page + hub files.
REM Double-click this file to run it. Safe to run more than once.
cd /d "%~dp0"

REM clear a stale git lock if present
if exist ".git\index.lock" del /f ".git\index.lock"

REM make sure the three game files are in place
set MISSING=0
if not exist "public\hubs\classroom-jeopardy.html" set MISSING=1
if not exist "public\hubs\paycheck-taxes.html" set MISSING=1
if not exist "public\hubs\lessonhub-lab.html" set MISSING=1
if %MISSING%==1 (
  echo.
  echo Some game files are missing from public\hubs.
  echo Save the three game cards from the Claude chat into:
  echo   %~dp0public\hubs
  echo then double-click this file again.
  echo.
  pause
  exit /b 1
)

git add .
git commit -m "add games page: classroom jeopardy, paycheck and taxes, lessonhub lab"
git push

echo.
echo Done. Check https://grant-desk.com/games/ in about a minute.
echo.
pause
