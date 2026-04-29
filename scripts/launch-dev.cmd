@echo off
REM ─────────────────────────────────────────────────────────────────────
REM launch-dev.cmd — Start ModuHome dev server (if not already running)
REM and open the browser. Targeted by the desktop shortcut.
REM
REM Behavior:
REM   1. If something is LISTENING on port 3000, skip the startup step.
REM   2. Otherwise spawn `npm run dev` in a new console window so its
REM      logs stay visible.
REM   3. Poll http://localhost:3000 until it returns 200 (max 60s).
REM   4. Open the URL in the default browser.
REM ─────────────────────────────────────────────────────────────────────
setlocal

set "PROJECT_DIR=C:\MHome\MContainer"
set "URL=http://localhost:3000"

REM ── 1. Already running? ──────────────────────────────────────────────
netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo Dev server already listening on port 3000 — skipping startup.
    goto :open_browser
)

REM ── 2. Start dev server in a new window so output stays visible ─────
echo Starting Next.js dev server...
start "ModuHome Dev" cmd /k "cd /d %PROJECT_DIR% && npm run dev"

REM ── 3. Poll for readiness (max 60s) ─────────────────────────────────
echo Waiting for server to be ready...
set /a attempts=0
:wait
set /a attempts+=1
if %attempts% gtr 60 (
    echo Server did not become ready in 60s. Opening browser anyway.
    goto :open_browser
)
timeout /t 1 /nobreak >nul
curl -s -o nul -w "%%{http_code}" %URL% 2>nul | findstr "200" >nul
if errorlevel 1 goto wait
echo Server ready after %attempts%s.

:open_browser
start "" %URL%

endlocal
