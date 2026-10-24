const ExcelJS = require('exceljs');
const pool = require('../db/pool');

// Turns a full name into a lowercase, no-space username base, e.g. "Ali Hassan" -> "ali_hassan"
function slugifyName(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ\s]/g, '') // keep letters/numbers/Arabic script, drop punctuation
    .replace(/\s+/g, '_');
}

// Generates a simple 4-character password: 2 random lowercase letters + 2 random digits, e.g. "kd47"
function generateSimplePassword() {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const l1 = letters[Math.floor(Math.random() * letters.length)];
  const l2 = letters[Math.floor(Math.random() * letters.length)];
  const n1 = Math.floor(Math.random() * 10);
  const n2 = Math.floor(Math.random() * 10);
  return `${l1}${l2}${n1}${n2}`;
}

// Ensures a username is unique by appending an incrementing number if needed.
// `db` is the pool by default; pass a transaction client so users created earlier in the same
// (not yet committed) transaction are seen too.
async function makeUniqueUsername(base, db = pool) {
  let candidate = base;
  let suffix = 1;
  while (true) {
    const existing = await db.query('SELECT id FROM users WHERE username = $1', [candidate]);
    if (existing.rows.length === 0) return candidate;
    suffix += 1;
    candidate = `${base}${suffix}`;
  }
}

// Builds the "Logins" workbook shared by every login sheet (teachers and students).
// rows: [{ name, username, password, role, grade, classroomSection }]
// Returns the .xlsx as a Buffer.
async function buildCredentialsBuffer(rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Logins');
  sheet.columns = [
    { header: 'Name', key: 'name', width: 28 },
    { header: 'Username', key: 'username', width: 24 },
    { header: 'Password', key: 'password', width: 14 },
    { header: 'Role', key: 'role', width: 10 },
    { header: 'Grade', key: 'grade', width: 12 },
    { header: 'Classroom', key: 'classroomSection', width: 12 }
  ];
  sheet.getRow(1).font = { bold: true };
  rows.forEach((r) =>
    sheet.addRow({
      name: r.name,
      username: r.username,
      password: r.password,
      role: r.role,
      grade: r.grade || '',
      classroomSection: r.classroomSection || ''
    })
  );
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

module.exports = { slugifyName, generateSimplePassword, makeUniqueUsername, buildCredentialsBuffer };
