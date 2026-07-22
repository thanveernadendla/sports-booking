const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

function durationMs(startedAt, endedAt) {
  return new Date(endedAt).getTime() - new Date(startedAt).getTime();
}

async function writeExcelReport({ results, summary, outputPath }) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SportZone Appium Suite';
  workbook.created = new Date();

  const overview = workbook.addWorksheet('Summary');
  overview.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 48 }
  ];
  overview.addRows([
    { metric: 'Application', value: 'SportZone Android' },
    { metric: 'Appium Server', value: summary.appiumServerUrl },
    { metric: 'APK', value: summary.appPath },
    { metric: 'Device', value: summary.deviceName },
    { metric: 'Execution Time', value: new Date().toLocaleString() },
    { metric: 'Total Steps', value: summary.total },
    { metric: 'Passed', value: summary.passed },
    { metric: 'Failed', value: summary.failed },
    { metric: 'Pass Rate', value: `${summary.passRate}%` }
  ]);

  const steps = workbook.addWorksheet('E2E Steps');
  steps.columns = [
    { header: '#', key: 'index', width: 8 },
    { header: 'Module', key: 'module', width: 22 },
    { header: 'Scenario', key: 'scenario', width: 42 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Duration ms', key: 'duration', width: 14 },
    { header: 'Details', key: 'details', width: 78 },
    { header: 'Screenshot', key: 'screenshot', width: 48 }
  ];

  results.forEach((result, index) => {
    steps.addRow({
      index: index + 1,
      module: result.module,
      scenario: result.name,
      status: result.status,
      duration: durationMs(result.startedAt, result.endedAt),
      details: result.details || '',
      screenshot: result.screenshot || ''
    });
  });

  const modules = workbook.addWorksheet('Module Analysis');
  modules.columns = [
    { header: 'Module', key: 'module', width: 26 },
    { header: 'Total', key: 'total', width: 10 },
    { header: 'Passed', key: 'passed', width: 10 },
    { header: 'Failed', key: 'failed', width: 10 },
    { header: 'Pass Rate', key: 'passRate', width: 14 }
  ];
  const grouped = {};
  for (const result of results) {
    grouped[result.module] ||= { total: 0, passed: 0, failed: 0 };
    grouped[result.module].total += 1;
    grouped[result.module][result.status === 'PASS' ? 'passed' : 'failed'] += 1;
  }
  Object.entries(grouped).forEach(([module, item]) => {
    modules.addRow({
      module,
      total: item.total,
      passed: item.passed,
      failed: item.failed,
      passRate: `${Math.round((item.passed / item.total) * 100)}%`
    });
  });

  for (const sheet of workbook.worksheets) {
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.eachRow(row => {
      row.eachCell(cell => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };
        cell.alignment = { vertical: 'top', wrapText: true };
      });
    });
  }

  steps.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const status = row.getCell('D').value;
    row.getCell('D').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: status === 'PASS' ? 'FFDCFCE7' : 'FFFEE2E2' }
    };
  });

  await workbook.xlsx.writeFile(outputPath);
  return outputPath;
}

module.exports = { writeExcelReport };
