@echo off
REM publish.bat - commits and pushes whatever has changed on the site.
REM Double-click to run. Use this for everyday updates.
cd /d "%~dp0"

if exist ".git\index.lock" del /f ".git\index.lock"

git add .
git commit -m "update the desk"
git push

echo.
echo Done. Changes live at https://grant-desk.com in about a minute.
echo.
pause
