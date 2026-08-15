import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import db from './database.js';

const REPORT_COLUMNS = [
  { key: 'beneficiaryName', label: 'Beneficiary Name' },
  { key: 'rsbsaNumber', label: 'RSBSA Number' },
  { key: 'barangay', label: 'Barangay' },
  { key: 'program', label: 'Program' },
  { key: 'intervention', label: 'Intervention' },
  { key: 'distributionCycle', label: 'Distribution Cycle' },
  { key: 'date', label: 'Date' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'unit', label: 'Unit' },
  { key: 'status', label: 'Status' }
];

/**
 * Derives a distribution cycle label (e.g. "2024-Q2 Dry Season") from a
 * real intervention date. The database has no separate distribution_cycles
 * table, so cycles are computed from actual intervention records.
 */
function formatCycle(dateString) {
  if (!dateString) return '';
  const parsed = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return '';

  const year = parsed.getFullYear();
  const quarter = Math.floor(parsed.getMonth() / 3) + 1;
  const season = parsed.getMonth() < 6 ? 'Dry Season' : 'Wet Season';
  return `${year}-Q${quarter} ${season}`;
}

/**
 * Converts a cycle label back into an inclusive [start, end] date range
 * used to filter intervention records.
 */
function getCycleRange(cycleLabel) {
  const match = /^(\d{4})-Q([1-4])\s/.exec(cycleLabel || '');
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const quarter = parseInt(match[2], 10);
  const startMonth = (quarter - 1) * 3;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 0);

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  };
}

export function getReportFilters() {
  const programs = ['All (DA & LGU)', 'DA Intervention', 'LGU Intervention'];

  const cycleRows = db.prepare(`
    SELECT DISTINCT intervention_date
    FROM interventions
    WHERE intervention_date IS NOT NULL AND intervention_date != ''
    ORDER BY intervention_date DESC
  `).all();

  const seen = new Set();
  const distributionCycles = [];
  for (const row of cycleRows) {
    const label = formatCycle(row.intervention_date);
    if (label && !seen.has(label)) {
      seen.add(label);
      distributionCycles.push(label);
    }
  }

  return { programs, distributionCycles };
}

export function getReportRecords({ program, startDate, endDate, distributionCycle } = {}) {
  let query = `
    SELECT
      b.name AS beneficiary_name,
      b.rsbsa_number,
      b.barangay,
      i.intervention_type,
      i.intervention_name,
      i.intervention_date,
      i.status
    FROM interventions i
    JOIN beneficiaries b ON b.id = i.beneficiary_id
    WHERE 1=1
  `;
  const params = [];

  if (program && program !== 'All (DA & LGU)') {
    query += ' AND i.intervention_type = ?';
    params.push(program === 'DA Intervention' ? 'DA' : 'LGU');
  }

  if (startDate) {
    query += ' AND i.intervention_date >= ?';
    params.push(startDate);
  }

  if (endDate) {
    query += ' AND i.intervention_date <= ?';
    params.push(endDate);
  }

  if (distributionCycle) {
    const range = getCycleRange(distributionCycle);
    if (range) {
      query += ' AND i.intervention_date >= ? AND i.intervention_date <= ?';
      params.push(range.start, range.end);
    }
  }

  query += ' ORDER BY i.intervention_date DESC, b.name ASC';

  const rows = db.prepare(query).all(...params);

  return rows.map((row) => ({
    beneficiaryName: row.beneficiary_name,
    rsbsaNumber: row.rsbsa_number || '',
    barangay: row.barangay,
    program: row.intervention_type,
    intervention: row.intervention_name,
    distributionCycle: formatCycle(row.intervention_date),
    date: row.intervention_date || '',
    quantity: '',
    unit: '',
    status: row.status
  }));
}

/* ------------------------------ CSV export ------------------------------ */

export function generateCsv(records) {
  const escapeCell = (value) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const header = REPORT_COLUMNS.map((column) => column.label).join(',');
  const rows = records.map((record) =>
    REPORT_COLUMNS.map((column) => escapeCell(record[column.key])).join(',')
  );

  return `\ufeff${header}\r\n${rows.join('\r\n')}\r\n`;
}

/* ----------------------------- Excel export ----------------------------- */

export async function generateExcel(records) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('AGAPAY Report');

  sheet.columns = REPORT_COLUMNS.map((column) => ({
    header: column.label,
    key: column.key,
    width: 18
  }));

  const headerRow = sheet.getRow(1);
  headerRow.height = 22;
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF667EEA' } };
  headerRow.alignment = { vertical: 'middle' };

  records.forEach((record) => sheet.addRow(record));

  sheet.autoFilter = {
    from: 'A1',
    to: `${String.fromCharCode(64 + REPORT_COLUMNS.length)}1`
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/* ------------------------------ PDF export ------------------------------ */

const PDF_COLUMN_WIDTHS = {
  beneficiaryName: 108,
  rsbsaNumber: 84,
  barangay: 82,
  program: 62,
  intervention: 108,
  distributionCycle: 88,
  date: 62,
  quantity: 48,
  unit: 40,
  status: 76
};

const PDF_ROW_HEIGHT = 22;
const PDF_MARGIN = 30;
const PDF_HEADER_FILL = '#667eea';
const PDF_ALT_FILL = '#f5f3ff';

export function generatePdf(records) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: PDF_MARGIN });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - PDF_MARGIN * 2;

    const drawHeader = () => {
      if (doc.y > doc.page.height - 60) {
        doc.addPage();
        doc.y = PDF_MARGIN;
      }
      const yStart = doc.y;
      doc.rect(PDF_MARGIN, yStart, pageWidth, PDF_ROW_HEIGHT).fill(PDF_HEADER_FILL);
      let x = PDF_MARGIN;
      REPORT_COLUMNS.forEach((column) => {
        doc
          .fillColor('#ffffff')
          .font('Helvetica-Bold')
          .fontSize(8)
          .text(column.label, x + 4, yStart + 7, {
            width: PDF_COLUMN_WIDTHS[column.key] - 8,
            height: PDF_ROW_HEIGHT - 2,
            ellipsis: true,
            lineBreak: false
          });
        x += PDF_COLUMN_WIDTHS[column.key];
      });
      doc.y = yStart + PDF_ROW_HEIGHT;
    };

    // Document banner
    doc.rect(0, 0, doc.page.width, 92).fill('#f5f3ff');
    doc.fillColor('#667eea').font('Helvetica-Bold').fontSize(20).text('AGAPAY', PDF_MARGIN, 22);
    doc
      .fillColor('#333333')
      .font('Helvetica-Bold')
      .fontSize(12)
      .text('Intervention Distribution Report', PDF_MARGIN, 50);
    doc
      .fillColor('#555555')
      .font('Helvetica')
      .fontSize(9)
      .text(`Generated: ${new Date().toLocaleDateString('en-PH')}  •  Records: ${records.length}`, PDF_MARGIN, 70);
    doc.y = 100;

    drawHeader();

    records.forEach((record, index) => {
      if (doc.y > doc.page.height - 60) {
        doc.addPage();
        doc.y = PDF_MARGIN;
        drawHeader();
      }

      const yStart = doc.y;
      doc
        .rect(PDF_MARGIN, yStart, pageWidth, PDF_ROW_HEIGHT)
        .fill(index % 2 === 0 ? PDF_ALT_FILL : '#ffffff');

      let x = PDF_MARGIN;
      REPORT_COLUMNS.forEach((column) => {
        doc
          .fillColor('#333333')
          .font('Helvetica')
          .fontSize(8)
          .text(String(record[column.key] ?? ''), x + 4, yStart + 7, {
            width: PDF_COLUMN_WIDTHS[column.key] - 8,
            height: PDF_ROW_HEIGHT - 2,
            ellipsis: true,
            lineBreak: false
          });
        x += PDF_COLUMN_WIDTHS[column.key];
      });
      doc.y = yStart + PDF_ROW_HEIGHT;
    });

    doc.end();
  });
}

export function getExportExtensions() {
  return { pdf: 'pdf', excel: 'xlsx', xlsx: 'xlsx', csv: 'csv' };
}
