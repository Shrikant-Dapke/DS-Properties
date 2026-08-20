import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function jspdf() {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  return doc;
}

export function exportTableToPdf({ title, subtitle, columns, rows }) {
  const doc = jspdf();
  doc.setFontSize(14);
  doc.text(title, 40, 40);
  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(subtitle, 40, 56);
  }
  autoTable(doc, {
    startY: subtitle ? 70 : 52,
    head: [columns.map((c) => c.label)],
    body: rows.map((row) => columns.map((c) => (c.render ? c.render(row) : String(row[c.key] ?? '')))),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [6, 95, 70] },
  });
  doc.save(`${title.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}.pdf`);
}

