@echo off
setlocal enabledelayedexpansion
echo ============================================
echo   TradieMate Android Build Tool
echo ============================================
echo.

:: --------------- Environment Setup ---------------
:: JAVA_HOME: Try Android Studio bundled JBR first
if not defined JAVA_HOME (
    if exist "C:\Program Files\Android\Android Studio\jbr" (
        set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
    ) else if exist "C:\Program Files\Android\Android Studio\jre" (
        set "JAVA_HOME=C:\Program Files\Android\Android Studio\jre"
    ) else (
        echo ERROR: Cannot find Java. Install Android Studio or set JAVA_HOME.
        goto :error
    )
)

:: ANDROID_HOME: Use local.properties path or standard location
if not defined ANDROID_HOME (
    set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
)
set "ANDROID_SDK_ROOT=%ANDROID_HOME%"

:: Add tools to PATH
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\tools;%PATH%"

echo JAVA_HOME  = %JAVA_HOME%
echo ANDROID_HOME = %ANDROID_HOME%
echo.

:: --------------- Parse Arguments ---------------
set BUILD_TYPE=debug
set INSTALL=0
set OPEN_STUDIO=0
set BUNDLE=0
set BUMP=0
set CLEAN=0

:parse_args
if "%~1"=="" goto :after_args
if /i "%~1"=="release" set BUILD_TYPE=release
if /i "%~1"=="--release" set BUILD_TYPE=release
if /i "%~1"=="--install" set INSTALL=1
if /i "%~1"=="-i" set INSTALL=1
if /i "%~1"=="--open" set OPEN_STUDIO=1
if /i "%~1"=="-o" set OPEN_STUDIO=1
if /i "%~1"=="--bundle" set BUNDLE=1
if /i "%~1"=="-b" set BUNDLE=1
if /i "%~1"=="--bump" set BUMP=1
if /i "%~1"=="--clean" set CLEAN=1
if /i "%~1"=="--help" goto :help
if /i "%~1"=="-h" goto :help
shift
goto :parse_args
:after_args

:: --------------- Build Web Assets ---------------
echo [1/4] Building web assets...
cd /d "L:\TradieMate\elevate-mobile-experience"
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Web build failed.
    goto :error
)

:: --------------- Sync Capacitor ---------------
echo.
echo [2/4] Syncing Capacitor...
call npx cap sync android
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Capacitor sync failed.
    goto :error
)

:: --------------- Version Bump ---------------
if %BUMP%==1 (
    echo.
    echo [*] Bumping version...
    set "PROPS=L:\TradieMate\elevate-mobile-experience\android\app\version.properties"
    if exist "!PROPS!" (
        for /f "tokens=2 delims==" %%A in ('findstr "versionCode" "!PROPS!"') do set /a "NEW_VERSION=%%A+1"
        echo versionCode=!NEW_VERSION!> "!PROPS!"
        echo     Version bumped to !NEW_VERSION!
    ) else (
        echo versionCode=2> "!PROPS!"
        echo     Version initialized to 2
    )
)

:: --------------- Gradle Build ---------------
echo.
cd /d "L:\TradieMate\elevate-mobile-experience\android"

if %CLEAN%==1 (
    echo [*] Cleaning build...
    call gradlew.bat clean
)

if %BUNDLE%==1 (
    echo [3/4] Building release AAB bundle...
    call gradlew.bat bundleRelease
    set GRADLE_RESULT=%ERRORLEVEL%
) else if "%BUILD_TYPE%"=="release" (
    echo [3/4] Building release APK...
    call gradlew.bat assembleRelease
    set GRADLE_RESULT=%ERRORLEVEL%
) else (
    echo [3/4] Building debug APK...
    call gradlew.bat assembleDebug
    set GRADLE_RESULT=%ERRORLEVEL%
)

if !GRADLE_RESULT! NEQ 0 (
    echo ERROR: Gradle build failed.
    goto :error
)

:: --------------- Output ---------------
echo.
echo [4/4] Build complete!
echo.
echo --- Output Files ---

if %BUNDLE%==1 (
    echo AAB Bundle:
    dir /s /b "app\build\outputs\bundle\release\*.aab" 2>nul
) else if "%BUILD_TYPE%"=="release" (
    echo Release APK:
    dir /s /b "app\build\outputs\apk\release\*.apk" 2>nul
) else (
    echo Debug APK:
    dir /s /b "app\build\outputs\apk\debug\*.apk" 2>nul
)

:: --------------- Install on Device ---------------
if %INSTALL%==1 (
    echo.
    echo Installing on connected device...
    if "%BUILD_TYPE%"=="release" (
        for /f "delims=" %%F in ('dir /s /b "app\build\outputs\apk\release\*.apk" 2^>nul') do (
            adb install -r "%%F"
        )
    ) else (
        for /f "delims=" %%F in ('dir /s /b "app\build\outputs\apk\debug\*.apk" 2^>nul') do (
            adb install -r "%%F"
        )
    )
    if %ERRORLEVEL% EQU 0 (
        echo Installed! Launching app...
        adb shell am start -n com.tradiemate.app/.MainActivity
    ) else (
        echo WARNING: Install failed. Is your device connected with USB debugging?
    )
)

:: --------------- Open Android Studio ---------------
if %OPEN_STUDIO%==1 (
    echo.
    echo Opening Android Studio...
    start "" "C:\Program Files\Android\Android Studio\bin\studio64.exe" "L:\TradieMate\elevate-mobile-experience\android"
)

echo.
echo ============================================
echo   BUILD SUCCESSFUL
echo ============================================
echo.
echo Quick commands:
echo   build-android              Debug APK
echo   build-android --release    Release APK
echo   build-android --bundle     Release AAB (Play Store)
echo   build-android -i           Build + install on device
echo   build-android -o           Build + open Android Studio
echo   build-android --bump       Increment version before build
echo   build-android --clean      Clean before build
echo.
goto :end

:help
echo.
echo Usage: build-android [options]
echo.
echo Options:
echo   (no args)       Build debug APK
echo   release         Build release APK
echo   --bundle, -b    Build release AAB for Play Store
echo   --install, -i   Install APK on connected device after build
echo   --open, -o      Open project in Android Studio after build
echo   --bump          Increment versionCode before building
echo   --clean         Run gradle clean before build
echo   --help, -h      Show this help
echo.
echo Combine options:  build-android release --bump --bundle
echo.
echo Environment variables (for release signing):
echo   TRADIEMATE_KEYSTORE_PATH       Path to .keystore file
echo   TRADIEMATE_KEYSTORE_PASSWORD   Keystore password
echo   TRADIEMATE_KEY_ALIAS           Key alias (default: tradiemate)
echo   TRADIEMATE_KEY_PASSWORD        Key password
echo.
goto :end

:error
echo.
echo ============================================
echo   BUILD FAILED
echo ============================================
exit /b 1

:end
endlocal
