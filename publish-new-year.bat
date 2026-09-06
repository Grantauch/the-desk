@echo off
REM Compatibility shortcut: use the same checked publisher; never delete files.
call "%~dp0publish.bat"
exit /b %ERRORLEVEL%
