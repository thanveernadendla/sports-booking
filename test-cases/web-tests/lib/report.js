const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

function durationMs(startedAt, endedAt) {
  return new Date(endedAt).getTime() - new Date(startedAt).getTime();
}

async function writeExcelReport({ results, summary, outputPath }) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SportZone Selenium Suite';
  workbook.created = new Date();

  const overview = workbook.addWorksheet('Summary');
  overview.columns = [
    { header: 'Metric', key: 'metric', width: 28 },
    { header: 'Value', key: 'value', width: 32 }
  ];
  overview.addRows([
    { metric: 'Application', value: 'SportZone Web' },
    { metric: 'Base URL', value: summary.baseUrl },
    { metric: 'Execution Time', value: new Date().toLocaleString() },
    { metric: 'Total Steps', value: summary.total },
    { metric: 'Passed', value: summary.passed },
    { metric: 'Failed', value: summary.failed },
    { metric: 'Pass Rate', value: `${summary.passRate}%` },
    { metric: 'Report Type', value: 'End-to-end Selenium analysis' }
  ]);

  const steps = workbook.addWorksheet('E2E Steps');
  steps.columns = [
    { header: '#', key: 'index', width: 8 },
    { header: 'Category', key: 'category', width: 22 },
    { header: 'Module', key: 'module', width: 22 },
    { header: 'Scenario', key: 'scenario', width: 42 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Duration ms', key: 'duration', width: 14 },
    { header: 'Details', key: 'details', width: 70 },
    { header: 'Screenshot', key: 'screenshot', width: 48 }
  ];

  results.forEach((result, index) => {
    steps.addRow({
      index: index + 1,
      category: result.category || result.module,
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

  const categories = workbook.addWorksheet('Category Analysis');
  categories.columns = [
    { header: 'Test Category', key: 'category', width: 28 },
    { header: 'Total', key: 'total', width: 10 },
    { header: 'Passed', key: 'passed', width: 10 },
    { header: 'Failed', key: 'failed', width: 10 },
    { header: 'Pass Rate', key: 'passRate', width: 14 }
  ];
  const categoryGroups = {};
  for (const result of results) {
    const category = result.category || result.module;
    categoryGroups[category] ||= { total: 0, passed: 0, failed: 0 };
    categoryGroups[category].total += 1;
    categoryGroups[category][result.status === 'PASS' ? 'passed' : 'failed'] += 1;
  }
  Object.entries(categoryGroups).forEach(([category, item]) => {
    categories.addRow({
      category,
      total: item.total,
      passed: item.passed,
      failed: item.failed,
      passRate: `${Math.round((item.passed / item.total) * 100)}%`
    });
  });

  const storage = workbook.addWorksheet('Backend Database Storage');
  storage.columns = [
    { header: 'Data Area', key: 'area', width: 28 },
    { header: 'Stored In', key: 'storedIn', width: 34 },
    { header: 'Local File / Collection', key: 'location', width: 38 },
    { header: 'Backend API Routes', key: 'routes', width: 62 },
    { header: 'Purpose', key: 'purpose', width: 60 }
  ];
  storage.addRows([
    {
      area: 'Customers and admin users',
      storedIn: 'MongoDB when MONGODB_URI is configured. Local JSON fallback otherwise.',
      location: 'data/db.json users array or MongoDB app_state document users field',
      routes: '/api/auth/register, /api/auth/login, /api/admin/login, /api/admin/users/:id/status',
      purpose: 'Stores mobile login customers, admin account, user role, phone, password, name, and approval status.'
    },
    {
      area: 'Venues and prices',
      storedIn: 'MongoDB when MONGODB_URI is configured. Local JSON fallback otherwise.',
      location: 'data/db.json venues array or MongoDB app_state document venues field',
      routes: '/api/config, /api/admin/venues, /api/admin/venues/:id',
      purpose: 'Stores venue names, categories, approval status, and INR booking fees controlled by admin.'
    },
    {
      area: 'Bookings and slot blocking',
      storedIn: 'MongoDB when MONGODB_URI is configured. Local JSON fallback otherwise.',
      location: 'data/db.json bookings array or MongoDB app_state document bookings field',
      routes: '/api/bookings, /api/bookings/:id, /api/slots, /api/admin/bookings/:id/status',
      purpose: 'Stores customer booking requests. Pending and approved bookings block the same venue/time from another customer.'
    },
    {
      area: 'Tournaments',
      storedIn: 'MongoDB when MONGODB_URI is configured. Local JSON fallback otherwise.',
      location: 'data/db.json tournaments array or MongoDB app_state document tournaments field',
      routes: '/api/admin/tournaments, /api/admin/tournaments/:id',
      purpose: 'Stores tournament records created and managed by admin.'
    },
    {
      area: 'Tournament venue requests',
      storedIn: 'MongoDB when MONGODB_URI is configured. Local JSON fallback otherwise.',
      location: 'data/db.json tournamentVenueRequests array or MongoDB app_state document tournamentVenueRequests field',
      routes: '/api/tournament-venue-requests, /api/admin/tournament-venue-requests/:id/status',
      purpose: 'Stores customer requests for tournament venues and admin approval/rejection status.'
    },
    {
      area: 'Backend server',
      storedIn: 'Node.js Express application',
      location: 'server.js',
      routes: 'All /api/* routes',
      purpose: 'Serves frontend files, validates logins, signs JWT tokens, reads/writes database state, and calculates dashboard stats.'
    }
  ]);

  for (const sheet of workbook.worksheets) {
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
    sheet.getRow(1).alignment = { vertical: 'middle' };
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
    const status = row.getCell('E').value;
    row.getCell('E').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: status === 'PASS' ? 'FFDCFCE7' : 'FFFEE2E2' }
    };
  });

  await workbook.xlsx.writeFile(outputPath);
  return outputPath;
}

module.exports = { writeExcelReport };
