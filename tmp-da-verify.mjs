import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import Database from 'better-sqlite3';

const base = 'http://localhost:3001';

const loginRes = await fetch(`${base}/api/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'encoder@agapay.gov', password: 'encoder123' })
});
const login = await loginRes.json();
console.log('LOGIN_STATUS', loginRes.status, login.message || login.error || 'ok');

if (!login.token) {
  throw new Error('No login token returned');
}

const ts = Date.now();
const tmpFile = path.join(process.cwd(), 'tmp-da-verify.xlsx');
const rows = [
  ['first_name', 'last_name', 'barangay', 'birthdate', 'lgu_intervention', 'beneficiary_type', 'rsbsa_number'],
  ['Test', `DAImport${ts}`, 'Poblacion', '1990-01-01', 'Certified Rice Seeds', 'DA', `RSBSA-VERIFY-${ts}`]
];
const ws = XLSX.utils.aoa_to_sheet(rows);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
XLSX.writeFile(wb, tmpFile);

const form = new FormData();
form.append('file', new Blob([fs.readFileSync(tmpFile)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'tmp-da-verify.xlsx');

const previewRes = await fetch(`${base}/api/encoding/excel/preview`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${login.token}` },
  body: form
});
const preview = await previewRes.json();
console.log('PREVIEW_STATUS', previewRes.status, preview.message || preview.error || 'ok');
console.log('PREVIEW_ERRORS', JSON.stringify(preview.errors || []));
console.log('PREVIEW_TYPE', preview.preview && preview.preview[0] ? preview.preview[0].beneficiaryType : null);

if (previewRes.status !== 200 || (preview.errors && preview.errors.length)) {
  throw new Error('Preview validation failed');
}

const confirmRes = await fetch(`${base}/api/encoding/excel/confirm`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${login.token}`
  },
  body: JSON.stringify({ previewToken: preview.previewToken })
});
const confirm = await confirmRes.json();
console.log('CONFIRM_STATUS', confirmRes.status, confirm.message || confirm.error || 'ok');

const db = new Database(path.join(process.cwd(), 'server', 'agapay.db'));
const row = db.prepare("SELECT beneficiary_type, rsbsa_number, first_name, last_name FROM beneficiaries WHERE last_name = ? ORDER BY id DESC LIMIT 1").get(`DAImport${ts}`);
console.log('DB_ROW', JSON.stringify(row));
db.close();

if (!row || row.beneficiary_type !== 'DA' || row.rsbsa_number !== `RSBSA-VERIFY-${ts}`) {
  throw new Error('Persisted record did not retain DA classification');
}

console.log('VERIFICATION_OK');

try {
  fs.unlinkSync(tmpFile);
} catch {}
