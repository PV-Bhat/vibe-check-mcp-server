@echo off
echo ========================================================
echo Vibe Check MCP Server Installer for Cursor IDE (Windows)
echo ========================================================
echo.

:: Check for administrative privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Error: This script requires administrative privileges.
    echo Please run as administrator.
    pause
    exit /b 1
)

:: Check for Node.js installation
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo Error: Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Check for npm installation
where npm >nul 2>&1
if %errorLevel% neq 0 (
    echo Error: npm is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Step 1: Installing vibe-check-mcp globally...
call npm install -g vibe-check-mcp

if %errorLevel% neq 0 (
    echo Error: Failed to install vibe-check-mcp globally.
    pause
    exit /b 1
)

echo.
echo Step 2: Finding global npm installation path...
for /f "tokens=*" %%i in ('npm root -g') do set NPM_GLOBAL=%%i
set VIBE_CHECK_PATH=%NPM_GLOBAL%\vibe-check-mcp\build\index.js

if not exist "%VIBE_CHECK_PATH%" (
    echo Error: Could not find vibe-check-mcp installation at %VIBE_CHECK_PATH%
    pause
    exit /b 1
)

echo Found vibe-check-mcp at: %VIBE_CHECK_PATH%
echo.

echo Step 3: Enter your Gemini API key for vibe-check-mcp...
set /p GEMINI_API_KEY="Enter your Gemini API key: "

:: Create .env file in user's home directory
echo Creating .env file for Gemini API key...
set ENV_FILE=%USERPROFILE%\.vibe-check-mcp.env
echo GEMINI_API_KEY=%GEMINI_API_KEY% > "%ENV_FILE%"

:: Create batch script to start with API key
set START_SCRIPT=%USERPROFILE%\start-vibe-check-mcp.bat
(
echo @echo off
echo set /p GEMINI_API_KEY=^<"%ENV_FILE%"
echo set GEMINI_API_KEY=%%GEMINI_API_KEY:GEMINI_API_KEY=%%
echo node "%VIBE_CHECK_PATH%"
) > "%START_SCRIPT%"

echo.
echo Step 4: Setting up Cursor IDE configuration...
echo.
echo To complete setup, you need to configure Cursor IDE:
echo.
echo 1. Open Cursor IDE
echo 2. Go to Settings (gear icon) -^> MCP
echo 3. Click "Add New MCP Server"
echo 4. Enter the following information:
echo    - Name: Vibe Check
echo    - Type: Command
echo    - Command: env GEMINI_API_KEY=%GEMINI_API_KEY% node "%VIBE_CHECK_PATH%"
echo 5. Click "Save" and then "Refresh"
echo.
echo Installation complete!
echo.
echo You can also manually run it by executing: %START_SCRIPT%
echo.
pause