@echo off
echo.
echo 🚀 Starting Local Development Environment
echo ==========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js is not installed. Please install Node.js 18.x or later.
    exit /b 1
)

echo ✅ Node.js is installed
node --version
echo.

REM Install root dependencies if needed
if not exist "node_modules\" (
    echo 📦 Installing root dependencies...
    call npm install
)

REM Install local server dependencies
echo 📦 Installing local server dependencies...
cd local-server
if not exist "node_modules\" (
    call npm install
)
cd ..

REM Install frontend dependencies
echo 📦 Installing frontend dependencies...
cd frontend
if not exist "node_modules\" (
    call npm install
)
cd ..

echo.
echo ✅ All dependencies installed!
echo.
echo 🚀 Starting servers...
echo    - Backend: http://localhost:3001
echo    - Frontend: http://localhost:3000
echo.
echo Press Ctrl+C to stop all servers
echo.

REM Start both servers
call npm run dev
