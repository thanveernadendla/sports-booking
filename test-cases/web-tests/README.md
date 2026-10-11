# SportZone Selenium E2E Tests

This folder contains a separate Node.js Selenium test suite for the SportZone web application.

## Run

```powershell
cd selenium-tests
npm install
npm test
```

Use headed browser mode:

```powershell
npm run test:headed
```

Start the application from the project root with `npm start` before running tests. Set `SPORTZONE_BASE_URL` to target another deployment and `SELENIUM_BROWSER` to select the installed browser (Chrome by default).

`npm run test:bulk` adds concurrent API response-time checks; set `WEB_API_LOAD_REQUESTS` to change its request count. `npm run test:ci` runs the interactive E2E suite and the API performance/regression suite. Coverage includes login/registration, booking and tournament approval flows, API validation and authorization, persisted data, accessibility basics, narrow viewport overflow, page-load timing, and browser capability reporting. Accessibility checks are automated smoke checks, not a complete WCAG audit.

Generate a separate Excel test-case catalog with 300 individually identified Selenium cases and 300 Appium cases:

```powershell
npm run test:catalog
```

The workbook is written to `selenium-tests/reports/sportzone-test-case-catalog.xlsx`. Its web and Android tabs include preconditions, data, steps, expected results, and editable execution status; cases start as `Not Run` until executed.

## Output

Reports are generated in:

```text
selenium-tests/reports/
```

Reports are Excel workbooks named like:

```text
sportzone-selenium-report-YYYY-MM-DD-HH-mm-ss.xlsx
```

Each workbook includes Summary, E2E Steps, Module Analysis, and Category Analysis sheets. Failure screenshots are saved under `reports/screenshots/`. The E2E runner backs up `data/db.json` before the suite and restores it after the suite.
