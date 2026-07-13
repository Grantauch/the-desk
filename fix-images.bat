@echo off
REM fix-images.bat - renames the three social-card images to their proper names,
REM then publishes. Double-click to run. Delete this file afterward if you like.
cd /d "%~dp0public"

if exist "4ad1eef3-95cb-45b7-a78f-4f2e30cbbe91.png" ren "4ad1eef3-95cb-45b7-a78f-4f2e30cbbe91.png" "og-hidden-history.png"
if exist "4c059a61-3675-4c50-b524-076a75e02bcf.png" ren "4c059a61-3675-4c50-b524-076a75e02bcf.png" "og-beyond-the-scoreboard.png"
if exist "4cde6b14-eaae-46df-9cc7-4e9cee9dad65.png" ren "4cde6b14-eaae-46df-9cc7-4e9cee9dad65.png" "og-us-history.png"

cd /d "%~dp0"
if exist ".git\index.lock" del /f ".git\index.lock"
git add .
git commit -m "add per-course social card images"
git push

echo.
echo Done. Images renamed and published.
echo.
pause
