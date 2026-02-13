@echo off
echo === Starting Android Emulator ===
set "ANDROID_HOME=C:\Users\davin\AppData\Local\Android\Sdk"

echo Available AVDs:
"%ANDROID_HOME%\emulator\emulator" -list-avds

echo.
echo Starting emulator...
start "" "%ANDROID_HOME%\emulator\emulator" -avd Medium_Phone -no-snapshot-load

echo Waiting for device to boot...
"%ANDROID_HOME%\platform-tools\adb" wait-for-device

echo.
echo Installing APK...
"%ANDROID_HOME%\platform-tools\adb" install -r "L:\TradieMate\elevate-mobile-experience\android\app\build\outputs\apk\debug\app-debug.apk"

echo.
echo Launching app...
"%ANDROID_HOME%\platform-tools\adb" shell am start -n com.tradiemate.app/.MainActivity

echo.
echo === Done! App should be running on emulator ===
pause
