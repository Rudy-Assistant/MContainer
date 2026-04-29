@echo off
REM ──────────────────────────────────────────────────────────────
REM  ModuHome launcher — opens the editor in the default browser,
REM  auto-starting the Next dev server if it's not already running.
REM
REM  Hardened version (rev 2): explicit error surfacing, multiple
REM  browser-launch fallbacks, npm.cmd vs npm resolution, dev-log
REM  capture so a silent npm failure is no longer silent.
REM ──────────────────────────────────────────────────────────────
setlocal EnableExtensions EnableDelayedExpansion

set "PROJECT_DIR=C:\MHome\MContainer"
set "URL=http://localhost:3000"
set "DEV_LOG=%TEMP%\moduhome-dev.log"

title ModuHome Launcher
echo.
echo   ModuHome Launcher (rev 2)
echo   -------------------------

REM ── 1. Is the dev server already up? ─────────────────────────
REM Raw TCP probe — faster than HTTP and more reliable in cmd vs the
REM previous Invoke-WebRequest approach which sometimes returned non-zero
REM despite a healthy server (PowerShell exit-code propagation quirk).
echo   [1/4] Probing %URL% ...
powershell -NoProfile -Command "$c = New-Object Net.Sockets.TcpClient; try { $c.Connect('localhost', 3000); $c.Close(); exit 0 } catch { exit 1 }"

if !ERRORLEVEL! EQU 0 (
    echo   [1/4] Dev server already running. Skipping spawn.
    goto :open_browser
)

REM ── 2. Not running → spawn a detached dev server ─────────────
if not exist "%PROJECT_DIR%\package.json" (
    echo.
    echo   ERROR: project not found at %PROJECT_DIR%
    echo   Edit this script's PROJECT_DIR variable if MContainer moved.
    pause
    exit /b 1
)

echo   [2/4] Starting dev server in %PROJECT_DIR% ...
echo         Log: %DEV_LOG%
REM Wipe stale log so the user always sees a fresh run.
if exist "%DEV_LOG%" del "%DEV_LOG%" >nul 2>&1
REM Use npm.cmd explicitly — `npm` alone resolves to a shell function on some
REM PowerShell setups but not from cmd. Pipe both stdout and stderr to the log.
start "ModuHome Dev Server" /D "%PROJECT_DIR%" /MIN cmd /c "npm.cmd run dev > "%DEV_LOG%" 2>&1"

REM ── 3. Poll until the port responds (cap: 90 seconds) ────────
echo   [3/4] Waiting for %URL% to come up ^(up to 90s^) ...
set /a _tries=0
:wait_loop
set /a _tries+=1
if !_tries! GTR 90 (
    echo.
    echo   ERROR: dev server did not become reachable after 90 seconds.
    echo   Last 20 lines of dev-server log ^(%DEV_LOG%^):
    echo   ---------------------------------------------------------
    powershell -NoProfile -Command "if (Test-Path '%DEV_LOG%') { Get-Content '%DEV_LOG%' -Tail 20 } else { 'no log written — npm.cmd not found?' }"
    echo   ---------------------------------------------------------
    echo   Press any key to close.
    pause >nul
    exit /b 1
)
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri '%URL%' -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop; exit 0 } catch { exit 1 }"
if !ERRORLEVEL! EQU 0 goto :open_browser
REM Use ping instead of timeout so we don't depend on timeout.exe being on PATH.
ping -n 2 127.0.0.1 >nul
goto :wait_loop

:open_browser
echo   [4/4] Opening browser ...
REM Triple fallback: cmd's `start`, then explorer.exe, then PowerShell Start-Process.
REM The empty "" first arg to `start` is required when the URL contains spaces or special chars.
start "" "%URL%" 2>nul
if !ERRORLEVEL! NEQ 0 (
    explorer.exe "%URL%" 2>nul
    if !ERRORLEVEL! NEQ 0 (
        powershell -NoProfile -Command "Start-Process '%URL%'"
    )
)
echo.
echo   Done. ModuHome is open at %URL%
echo   Dev-server log lives at: %DEV_LOG%
REM Brief pause via ping so the user sees the status before window closes.
ping -n 3 127.0.0.1 >nul
endlocal
exit /b 0
