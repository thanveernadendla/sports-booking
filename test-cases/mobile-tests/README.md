# SportZone Appium Android E2E Tests

This folder contains a separate Node.js Appium test suite for the SportZone Android app.

## Requirements

- Android device or emulator connected
- Appium server running
- UiAutomator2 driver installed
- Latest APK built from the current web assets
- SportZone Node.js API running and reachable from the Android device

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

`npm test` launches the APK and runs the real Android end-to-end suite. `npm run test:ci` runs static Android asset and configuration checks without a device; it is not a substitute for device E2E coverage.

Start the API from the project root before device tests:

```powershell
npm start
```

The emulator default API URL is `http://10.0.2.2:3000`. For a physical device, set `SPORTZONE_MOBILE_API_URL` to the host computer's reachable LAN URL (or an HTTPS deployment URL) and allow the device to reach that server.

Optional environment variables:

```powershell
$env:APPIUM_SERVER_URL="http://127.0.0.1:4723"
$env:ANDROID_DEVICE_NAME="Android Device"
$env:SPORTZONE_APK="C:\path\to\app-debug.apk"
$env:SPORTZONE_MOBILE_API_URL="http://10.0.2.2:3000"
```

The device suite covers customer registration, bookings and tournament requests, admin approvals, API authorization/validation, persistence, accessibility basics, mobile viewport overflow, and page-load timing. It requires a running API and an Android device/emulator. The accessibility checks are automated smoke checks, not a complete WCAG audit.

## Output

Reports are generated in:

```text
appium-tests/reports/
```

The report is an Excel workbook named like:

```text
sportzone-appium-report-YYYY-MM-DD-HH-mm-ss.xlsx
```

The workbook includes Summary, E2E Steps, Module Analysis, and Category Analysis sheets; failure screenshots are saved beside it under `reports/screenshots/`.
