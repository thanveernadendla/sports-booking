@echo off
set "JAVA_HOME=C:\AndroidSDK\jdk17\jdk-17.0.19+10"
set "ANDROID_HOME=C:\AndroidSDK"
set "ANDROID_SDK_ROOT=C:\AndroidSDK"
set "PATH=%JAVA_HOME%\bin;C:\AndroidSDK\platform-tools;C:\AndroidSDK\cmdline-tools\latest\bin;%PATH%"

echo JAVA_HOME = %JAVA_HOME%
echo ANDROID_HOME = %ANDROID_HOME%
echo.

cd /d "c:\Users\reddy\.gemini\antigravity\scratch\sportzone-app\android"

echo Building debug APK...
call gradlew.bat assembleDebug --no-daemon --stacktrace 2>&1

echo.
echo ===== BUILD RESULT =====
if exist "app\build\outputs\apk\debug\app-debug.apk" (
  echo SUCCESS! APK built at:
  echo app\build\outputs\apk\debug\app-debug.apk
  copy "app\build\outputs\apk\debug\app-debug.apk" "c:\Users\reddy\.gemini\antigravity\scratch\sportzone-app\SportZone.apk"
  echo Copied to: c:\Users\reddy\.gemini\antigravity\scratch\sportzone-app\SportZone.apk
) else (
  echo APK not found - build may have failed
)
