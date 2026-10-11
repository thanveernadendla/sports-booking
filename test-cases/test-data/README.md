# SportZone Test Reports

This folder contains Excel analysis files that can be opened directly from GitHub or downloaded.

## Reports

- `selenium-web-520-testcases-database-report.xlsx`
  - Selenium web application testing
  - 520+ named test cases
  - Includes Functional, UI/UX, Compatibility, Performance, Security, API, Database, Accessibility, Mobile-Specific, Regression, and E2E categories
  - Includes backend/database storage details

- `appium-android-520-testcases-database-report.xlsx`
  - Appium Android application testing
  - 520+ named Android/mobile test cases
  - Includes Functional, UI/UX, Compatibility, Performance, Security, API, Database, Accessibility, Mobile-Specific, Regression, and E2E categories
  - Includes backend/database storage details

## Database Storage Summary

SportZone stores application data in MongoDB when `MONGODB_URI` is configured. During local development, it uses the JSON fallback file `data/db.json`.

The backend storage logic is implemented in `server.js` through `readDB()` and `writeDB()`.
