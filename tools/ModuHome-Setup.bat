@echo off
setlocal EnableDelayedExpansion
title ModuHome Setup
color 0A

echo.
echo  ============================================
echo    ModuHome - One-Click Setup
echo  ============================================
echo.
echo  This will:
echo    1. Check for Git and Node.js
echo    2. Clone the project to your Desktop
echo    3. Install dependencies
echo    4. Create a desktop shortcut
echo    5. Launch ModuHome in your browser
echo.
echo  Press any key to begin...
pause >nul

:: ── Check prerequisites ──────────────────────────────

echo.
echo [1/6] Checking prerequisites...

where git >nul 2>&1
if %ERRORLEVEL% neq 0 (
    color 0C
    echo.
    echo  ERROR: Git is not installed!
    echo.
    echo  Please install Git from: https://git-scm.com/download/win
    echo  Then run this setup again.
    echo.
    pause
    exit /b 1
)
echo   [OK] Git found

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    color 0C
    echo.
    echo  ERROR: Node.js is not installed!
    echo.
    echo  Please install Node.js LTS from: https://nodejs.org
    echo  Then run this setup again.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo   [OK] Node.js found (%NODE_VER%)

where npm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    color 0C
    echo.
    echo  ERROR: npm is not available!
    echo  Please reinstall Node.js from https://nodejs.org
    echo.
    pause
    exit /b 1
)
echo   [OK] npm found

:: ── Set up install directory ─────────────────────────

set "DESKTOP=%USERPROFILE%\Desktop"
set "INSTALL_DIR=%DESKTOP%\ModuHome"

echo.
echo [2/6] Setting up project folder...

if exist "%INSTALL_DIR%" (
    echo   Folder already exists at: %INSTALL_DIR%
    echo.
    choice /c YN /m "  Delete and re-clone? (Y/N)"
    if !ERRORLEVEL! equ 1 (
        echo   Removing old folder...
        rmdir /s /q "%INSTALL_DIR%" 2>nul
        timeout /t 2 /nobreak >nul
    ) else (
        echo   Keeping existing folder. Skipping clone...
        goto :skip_clone
    )
)

:: ── Clone the repository ─────────────────────────────

echo.
echo [3/6] Cloning ModuHome repository...
echo   (This may take a minute on first run)
echo.

git clone --branch variant/brother --single-branch https://github.com/Rudy-Assistant/MContainer.git "%INSTALL_DIR%" 2>&1
if %ERRORLEVEL% neq 0 (
    echo.
    echo   Trying SSH instead...
    git clone --branch variant/brother --single-branch git@github.com:Rudy-Assistant/MContainer.git "%INSTALL_DIR%" 2>&1
    if %ERRORLEVEL% neq 0 (
        color 0C
        echo.
        echo  ERROR: Could not clone the repository!
        echo.
        echo  Make sure you have access to the repo.
        echo  Ask the repo owner to add you as a collaborator, or
        echo  install GitHub CLI and run: gh auth login
        echo.
        pause
        exit /b 1
    )
)

echo   [OK] Repository cloned

:skip_clone

:: ── Verify branch ────────────────────────────────────

echo.
echo [4/6] Verifying branch...

cd /d "%INSTALL_DIR%"
echo   [OK] On branch: variant/brother (cloned directly)

:: ── Install dependencies ─────────────────────────────

echo.
echo [5/6] Installing dependencies (this takes 2-5 minutes)...
echo.

cd /d "%INSTALL_DIR%"
call npm install 2>&1
if %ERRORLEVEL% neq 0 (
    color 0C
    echo.
    echo  ERROR: npm install failed!
    echo  Check the output above for details.
    echo.
    pause
    exit /b 1
)
echo.
echo   [OK] Dependencies installed

:: ── Create desktop shortcut + launcher ───────────────

echo.
echo [6/6] Creating desktop shortcut...

:: Write the launcher batch file
(
    echo @echo off
    echo title ModuHome
    echo color 0A
    echo echo.
    echo echo  =============================================
    echo echo    ModuHome - Container Home Designer
    echo echo  =============================================
    echo echo.
    echo echo  Starting ModuHome...
    echo echo  ^(Your browser will open automatically^)
    echo echo.
    echo echo  To stop: close this window or press Ctrl+C
    echo echo.
    echo.
    echo :: Kill any existing dev servers on port 3000
    echo for /f "tokens=5" %%%%p in ^('netstat -aon ^| findstr :3000 ^| findstr LISTENING 2^^^>nul'^) do ^(
    echo     taskkill /PID %%%%p /F ^^^>nul 2^^^>^^^&1
    echo ^)
    echo.
    echo cd /d "%INSTALL_DIR%"
    echo.
    echo :: Pull latest changes from variant/brother
    echo echo  Checking for updates...
    echo git pull --ff-only origin variant/brother 2^^^>nul
    echo echo.
    echo.
    echo :: Start dev server and open browser
    echo start "" "http://localhost:3000"
    echo call npm run dev
) > "%INSTALL_DIR%\ModuHome-Launcher.bat"

:: Create VBS shortcut maker (Windows shortcut creation)
(
    echo Set oWS = WScript.CreateObject^("WScript.Shell"^)
    echo sLinkFile = oWS.ExpandEnvironmentStrings^("%%USERPROFILE%%"^) ^& "\Desktop\ModuHome.lnk"
    echo Set oLink = oWS.CreateShortcut^(sLinkFile^)
    echo oLink.TargetPath = "%INSTALL_DIR%\ModuHome-Launcher.bat"
    echo oLink.WorkingDirectory = "%INSTALL_DIR%"
    echo oLink.Description = "Launch ModuHome Container Home Designer"
    echo oLink.IconLocation = "shell32.dll,12"
    echo oLink.Save
) > "%TEMP%\create_shortcut.vbs"

cscript //nologo "%TEMP%\create_shortcut.vbs"
del "%TEMP%\create_shortcut.vbs" 2>nul

echo   [OK] Desktop shortcut "ModuHome" created

:: ── Done! Launch it ──────────────────────────────────

echo.
echo  ============================================
echo    Setup Complete!
echo  ============================================
echo.
echo  Project location: %INSTALL_DIR%
echo  Branch: variant/brother
echo.
echo  You can now:
echo    - Double-click "ModuHome" on your desktop
echo    - Or run ModuHome-Launcher.bat in the project folder
echo.
echo  Press any key to launch ModuHome now...
pause >nul

:: Kill any existing dev servers on port 3000
for /f "tokens=5" %%p in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING 2^>nul') do (
    taskkill /PID %%p /F >nul 2>&1
)

cd /d "%INSTALL_DIR%"
start "" "http://localhost:3000"
call npm run dev
