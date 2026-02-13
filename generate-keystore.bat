@echo off
echo ============================================
echo   TradieMate - Generate Release Keystore
echo ============================================
echo.
echo This will create a signing keystore for Play Store releases.
echo IMPORTANT: Keep the keystore and passwords safe. If you lose them,
echo you cannot update your app on Play Store.
echo.

:: Find Java
if not defined JAVA_HOME (
    if exist "C:\Program Files\Android\Android Studio\jbr" (
        set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
    )
)

set "KEYTOOL=%JAVA_HOME%\bin\keytool.exe"
set "KEYSTORE_PATH=L:\TradieMate\elevate-mobile-experience\android\tradiemate-release.keystore"

if exist "%KEYSTORE_PATH%" (
    echo WARNING: Keystore already exists at:
    echo   %KEYSTORE_PATH%
    echo.
    set /p OVERWRITE="Overwrite? (y/N): "
    if /i not "!OVERWRITE!"=="y" goto :end
)

echo.
echo Generating keystore...
echo.

"%KEYTOOL%" -genkeypair ^
    -v ^
    -keystore "%KEYSTORE_PATH%" ^
    -alias tradiemate ^
    -keyalg RSA ^
    -keysize 2048 ^
    -validity 10000 ^
    -storepass tradiemate2026 ^
    -keypass tradiemate2026 ^
    -dname "CN=TradieMate, OU=Mobile, O=TradieMate Pty Ltd, L=Sydney, ST=NSW, C=AU"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================
    echo   KEYSTORE GENERATED SUCCESSFULLY
    echo ============================================
    echo.
    echo File: %KEYSTORE_PATH%
    echo Alias: tradiemate
    echo.
    echo To build signed releases, set these environment variables:
    echo.
    echo   set TRADIEMATE_KEYSTORE_PATH=%KEYSTORE_PATH%
    echo   set TRADIEMATE_KEYSTORE_PASSWORD=tradiemate2026
    echo   set TRADIEMATE_KEY_ALIAS=tradiemate
    echo   set TRADIEMATE_KEY_PASSWORD=tradiemate2026
    echo.
    echo CHANGE THE PASSWORD before production use!
    echo The keystore is in .gitignore and will NOT be committed.
) else (
    echo.
    echo ERROR: Keystore generation failed.
)

:end
pause
