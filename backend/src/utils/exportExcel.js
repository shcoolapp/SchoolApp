const ExcelJS = require('exceljs');

// Builds an .xlsx workbook buffer from a set of named sheets.
// sheetsData: { "Marks": [{col1: val, ...}, ...], "Homework": [...] }
async function buildWorkbook(sheetsData) {
  const workbook = new ExcelJS.Workbook();

  for (const [sheetName, rows] of Object.entries(sheetsData)) {
    const sheet = workbook.addWorksheet(sheetName);
    if (rows.length === 0) continue;

    const columns = Object.keys(rows[0]).map((key) => ({ header: key, key }));
    sheet.columns = columns;
    rows.forEach((row) => sheet.addRow(row));
  }

  return workbook.xlsx.writeBuffer();
}

module.exports = { buildWorkbook };
