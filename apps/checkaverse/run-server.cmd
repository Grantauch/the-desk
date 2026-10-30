@echo off
rem Keeps the Checkaverse server running. If it ever stops, it starts again five seconds later.
cd /d "%~dp0"
:loop
"C:\Program Files\nodejs\node.exe" --disable-warning=ExperimentalWarning server.mjs >> "D:\Checklings\storage\logs\server-console.log" 2>&1
timeout /t 5 /nobreak > nul
goto loop
