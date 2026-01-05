@echo off
echo ========================================
echo TradieMate - Quick Testing Setup
echo ========================================
echo.

echo [1/3] Building production version...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Build failed!
    pause
    exit /b 1
)

echo.
echo [2/3] Starting preview server...
echo.
echo ========================================
echo TEST OPTIONS:
echo ========================================
echo.
echo 1. WEB BROWSER (Fastest):
echo    - Open: http://localhost:4173
echo    - Press F12 for DevTools
echo    - Toggle device toolbar (Ctrl+Shift+M)
echo.
echo 2. MOBILE PWA (Recommended):
echo    - Deploy with: npm install -g netlify-cli
echo    - Then run: netlify deploy --prod
echo    - OR use ngrok: ngrok http 4173
echo.
echo 3. PHYSICAL DEVICE (Local Network):
echo    - Get your local IP: ipconfig
echo    - Open on phone: http://YOUR_IP:4173
echo.
echo ========================================
echo Starting server now...
echo Press Ctrl+C to stop
echo ========================================
echo.

call npm run preview
