import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import Database from 'better-sqlite3';
import { spawn } from 'child_process';

const ts = Date.now();
const filePath = path.join(process.cwd(), `tmp-da-import-${ts}.xlsx`);
const ws = XLSX.utils.aoa_to_sheet([
  ['first_name', 'last_name', 'barangay', 'birthdate', 'lgu_intervention', 'beneficiary_type', 'rsbsa_number'],
  ['Test', `DAImport${ts}`, 'Poblacion', '1990-01-01', 'Certified Rice Seeds', 'DA', `RSBSA-IM-${ts}`]
]);
XLSX.writeFile({ SheetNames: ['Sheet1'], Sheets: { Sheet1: ws } }, filePath);

const server = spawn('node', ['server/server.js'], { stdio: ['ignore', 'pipe', 'pipe'] });

try {
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const loginRes = await fetch('http://localhost:3001/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'encoder@agapay.gov', password: 'encoder123' })
  });
  const login = await loginRes.json();
  const token = login.token;

  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(filePath)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `tmp-da-import-${ts}.xlsx`);

  const previewRes = await fetch('http://localhost:3001/api/encoding/excel/preview', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
  const preview = await previewRes.json();

  console.log('PREVIEW_STATUS', previewRes.status);
  console.log('PREVIEW_ERRORS', JSON.stringify(preview.errors));
  console.log('PREVIEW_ROW', JSON.stringify(preview.preview && preview.preview[0]));

  if (previewRes.status !== 200) {
    throw new Error('Preview failed: ' + JSON.stringify(preview));
  }
  if (preview.errors && preview.errors.length) {
    throw new Error('Validation rejected valid DA row: ' + JSON.stringify(preview.errors));
  }
  if (!preview.preview || !preview.preview[0] || preview.preview[0].beneficiaryType !== 'DA') {
    throw new Error('DA type not preserved in preview');
  }

  const confirmRes = await fetch('http://localhost:3001/api/encoding/excel/confirm', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ previewToken: preview.previewToken })
  });
  const confirm = await confirmRes.json();
  console.log('CONFIRM_STATUS', confirmRes.status);
  console.log('CONFIRM_RESULT', JSON.stringify(confirm));

  if (confirmRes.status !== 200) {
    throw new Error('Confirm failed: ' + JSON.stringify(confirm));
  }

  const db = new Database(path.join(process.cwd(), 'server', 'agapay.db'));
  const row = db.prepare(
    "SELECT id, beneficiary_type, rsbsa_number FROM beneficiaries WHERE last_name = ? ORDER BY id DESC LIMIT 1"
  ).get(`DAImport${ts}`);

  const interventionRow = row
    ? db.prepare('SELECT intervention_type FROM interventions WHERE beneficiary_id = ? ORDER BY id DESC LIMIT 1').get(row.id)
    : null;
    
  db.close();
  console.log('VERIFIED_ROW', JSON.stringify(row));
  console.log('INTERVENTION_ROW', JSON.stringify(interventionRow));

  if (!row || row.beneficiary_type !== 'DA' || row.rsbsa_number !== `RSBSA-IM-${ts}`) {
    throw new Error('Persisted record did not retain DA classification');
  }
  if (!interventionRow || interventionRow.intervention_type !== 'DA') {
    throw new Error('Persisted intervention type was not DA');
  }

  console.log('ASSERTION_OK');
} catch (error) {
  console.error('VERIFY_ERROR', error && error.stack ? error.stack : error);
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
  setTimeout(() => {
    try { fs.unlinkSync(filePath); } catch {}
    process.exit();
  }, 250);
}
