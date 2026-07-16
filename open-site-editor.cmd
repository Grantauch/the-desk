@echo off
title The Desk - Site Editor
cd /d "%~dp0"
node editor\server.mjs
if errorlevel 1 (
  echo.
  echo The editor could not start. Send Grant the message above.
  pause
)
