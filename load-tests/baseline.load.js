const fs = require('fs');
const path = require('path');
const autocannon = require('autocannon');
const ExcelJS = require('exceljs');

const baseUrl = process.env.SPORTZONE_BASE_URL || 'http://localhost:3000';
const duration = Number(process.env.LOAD_DURATION_SECONDS || 60);
const connections = Number(process.env.LOAD_VUS || 100);
const minRequests = Number(process.env.LOAD_MIN_REQUESTS || 1000);
const maxAvgLatency = Number(process.env.LOAD_MAX_AVG_LATENCY_MS || 1500);
const maxP95Latency = Number(process.env.LOAD_MAX_P95_LATENCY_MS || 3500);
const maxErrors = Number(process.env.LOAD_MAX_ERRORS || 0);
const reportsDir = path.join(__dirname, 'reports');

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function percentileLatency(latency, key, fallbackKey) {
  return Number(latency[key] ?? latency[fallbackKey] ?? latency.p99 ?? latency.max ?? 0);
}

async function waitForApp() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/config`);
      if (response.ok) return;
    } catch {
      // Retry.
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`SportZone app is not reachable at ${baseUrl}`);
}

function runAutocannon() {
  return new Promise((resolve, reject) => {
    const instance = autocannon({
      url: baseUrl,
      connections,
      duration,
      pipelining: 1,
      timeout: 10,
      requests: [
        { method: 'GET', path: '/api/config' },
        { method: 'GET', path: '/api/dashboard/stats' },
        { method: 'GET', path: '/api/slots' },
        { method: 'GET', path: '/api/bookings' },
        { method: 'GET', path: '/' },
        { method: 'GET', path: '/dashboard.html' },
        { method: 'GET', path: '/admin-login.html' }
      ]
    }, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
    autocannon.track(instance, { renderProgressBar: true });
  });
}

async function writeReport(result, checks, outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SportZone Load Test';

  const summary = workbook.addWorksheet('Summary');
  summary.columns = [
    { header: 'Metric', key: 'metric', width: 34 },
    { header: 'Value', key: 'value', width: 28 }
  ];
  summary.addRows([
    { metric: 'Base URL', value: baseUrl },
    { metric: 'Virtual Users', value: connections },
    { metric: 'Duration Seconds', value: duration },
    { metric: 'Requests Per Second Average', value: result.requests.average },
    { metric: 'Total Requests', value: result.requests.total },
    { metric: 'Average Latency ms', value: result.latency.average },
    { metric: 'Minimum Latency ms', value: result.latency.min },
    { metric: 'Maximum Latency ms', value: result.latency.max },
    { metric: 'P95/P97.5 Latency ms', value: percentileLatency(result.latency, 'p95', 'p97_5') },
    { metric: 'P99 Latency ms', value: percentileLatency(result.latency, 'p99', 'p97_5') },
    { metric: 'Errors', value: Number(result.errors || 0) },
    { metric: 'Timeouts', value: Number(result.timeouts || 0) },
    { metric: 'Non-2xx Responses', value: Number(result.non2xx || 0) },
    { metric: 'Overall Status', value: checks.every(check => check.status === 'PASS') ? 'PASS' : 'FAIL' }
  ]);

  const checksSheet = workbook.addWorksheet('Checks');
  checksSheet.columns = [
    { header: 'Check', key: 'name', width: 46 },
    { header: 'Expected', key: 'expected', width: 28 },
    { header: 'Actual', key: 'actual', width: 24 },
    { header: 'Status', key: 'status', width: 12 }
  ];
  checksSheet.addRows(checks);

  const raw = workbook.addWorksheet('Raw Metrics');
  raw.columns = [
    { header: 'Metric', key: 'metric', width: 28 },
    { header: 'JSON', key: 'json', width: 90 }
  ];
  raw.addRows([
    { metric: 'requests', json: JSON.stringify(result.requests) },
    { metric: 'latency', json: JSON.stringify(result.latency) },
    { metric: 'throughput', json: JSON.stringify(result.throughput) },
    { metric: 'statusCodeStats', json: JSON.stringify(result.statusCodeStats) }
  ]);

  for (const sheet of workbook.worksheets) {
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.eachRow(row => {
      row.eachCell(cell => {
        cell.alignment = { vertical: 'top', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };
      });
    });
  }

  checksSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.getCell('D').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: row.getCell('D').value === 'PASS' ? 'FFDCFCE7' : 'FFFEE2E2' }
    };
  });

  await workbook.xlsx.writeFile(outputPath);
}

function buildChecks(result) {
  const errors = Number(result.errors || 0);
  const timeouts = Number(result.timeouts || 0);
  const non2xx = Number(result.non2xx || 0);
  const p95 = percentileLatency(result.latency, 'p95', 'p97_5');
  const checks = [
    {
      name: '100 virtual users configured',
      expected: '100',
      actual: connections,
      status: connections === 100 ? 'PASS' : 'FAIL'
    },
    {
      name: 'Continuous runtime is 1 minute',
      expected: '60 seconds',
      actual: duration,
      status: duration === 60 ? 'PASS' : 'FAIL'
    },
    {
      name: 'Total request volume',
      expected: `>= ${minRequests}`,
      actual: result.requests.total,
      status: result.requests.total >= minRequests ? 'PASS' : 'FAIL'
    },
    {
      name: 'Average response time',
      expected: `<= ${maxAvgLatency} ms`,
      actual: result.latency.average,
      status: result.latency.average <= maxAvgLatency ? 'PASS' : 'FAIL'
    },
    {
      name: 'P95 response time',
      expected: `<= ${maxP95Latency} ms`,
      actual: p95,
      status: p95 <= maxP95Latency ? 'PASS' : 'FAIL'
    },
    {
      name: 'Errors',
      expected: `<= ${maxErrors}`,
      actual: errors,
      status: errors <= maxErrors ? 'PASS' : 'FAIL'
    },
    {
      name: 'Timeouts',
      expected: '0',
      actual: timeouts,
      status: timeouts === 0 ? 'PASS' : 'FAIL'
    },
    {
      name: 'Non-2xx responses',
      expected: '0',
      actual: non2xx,
      status: non2xx === 0 ? 'PASS' : 'FAIL'
    }
  ];
  return checks;
}

async function run() {
  await waitForApp();
  console.log(`Running baseline load test: ${connections} users for ${duration}s at ${baseUrl}`);
  const result = await runAutocannon();
  const checks = buildChecks(result);
  const outputPath = path.join(reportsDir, `sportzone-load-report-${stamp()}.xlsx`);
  await writeReport(result, checks, outputPath);

  console.log(`RPS average: ${result.requests.average}`);
  console.log(`Response time ms avg/min/max: ${result.latency.average}/${result.latency.min}/${result.latency.max}`);
  console.log(`Excel report: ${outputPath}`);

  if (checks.some(check => check.status === 'FAIL')) {
    process.exitCode = 1;
  }
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
