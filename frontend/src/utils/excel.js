import ExcelJS from 'exceljs';

export async function exportTableToExcel({ filename, sheets }) {
  const workbook = new ExcelJS.Workbook();
  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.name);
    ws.columns = sheet.columns.map((c) => ({ header: c.label, key: c.key, width: c.width || 20 }));
    for (const row of sheet.rows) {
      const flat = {};
      for (const col of sheet.columns) {
        flat[col.key] = col.render ? col.render(row) : String(row[col.key] ?? '');
      }
      ws.addRow(flat);
    }
    ws.getRow(1).font = { bold: true };
  }
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}