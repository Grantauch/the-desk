@echo off
setlocal
REM Publish only an intentionally staged and reviewed batch on main.
cd /d "%~dp0"
node scripts\publish-site.mjs
set "PUBLISH_RESULT=%ERRORLEVEL%"
echo.
pause
exit /b %PUBLISH_RESULT%
