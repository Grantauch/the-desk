@echo off
REM publish-new-year.bat - deploys the 2026-27 course lineup.
REM Removes the retired law + economics pages, then commits and pushes everything.
REM Double-click this file to run it. Safe to run more than once.
cd /d "%~dp0"

REM clear a stale git lock if present
if exist ".git\index.lock" del /f ".git\index.lock"

REM retire the old course pages
if exist "src\pages\law.astro" del /f "src\pages\law.astro"
if exist "src\pages\economics.astro" del /f "src\pages\economics.astro"

git add .
git commit -m "2026-27 lineup: hidden history + beyond the scoreboard, us history reconstruction-forward, retire law and econ"
git push

echo.
echo Done. Check https://grant-desk.com in about a minute.
echo.
pause
