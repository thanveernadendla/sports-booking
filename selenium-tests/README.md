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

## Output

Reports are generated in:

```text
selenium-tests/reports/
```

The main report is an Excel workbook named like:

```text
sportzone-selenium-report-YYYY-MM-DD-HH-mm-ss.xlsx
```

The test runner backs up `data/db.json` before the suite and restores it after the suite.
