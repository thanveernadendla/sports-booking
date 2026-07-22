# SportZone Appium Android E2E Tests

This folder contains a separate Node.js Appium test suite for the SportZone Android app.

## Requirements

- Android device or emulator connected
- Appium server running
- UiAutomator2 driver installed
- Latest APK built from the current web assets

Build/sync the Android app first from the project root:

```powershell
npm run cap:sync
cd android
.\gradlew.bat assembleDebug
```

Install Appium tooling if needed:

```powershell
npm install -g appium
appium driver install uiautomator2
appium
```

## Run

```powershell
cd appium-tests
npm install
npm test
```

Optional environment variables:

```powershell
$env:APPIUM_SERVER_URL="http://127.0.0.1:4723"
$env:ANDROID_DEVICE_NAME="Android Device"
$env:SPORTZONE_APK="C:\path\to\app-debug.apk"
```

## Output

Reports are generated in:

```text
appium-tests/reports/
```

The main report is an Excel workbook named like:

```text
sportzone-appium-report-YYYY-MM-DD-HH-mm-ss.xlsx
```
