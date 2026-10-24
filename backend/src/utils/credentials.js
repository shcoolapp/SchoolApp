const ExcelJS = require('exceljs');
const QRCode = require('qrcode');
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

// The portal's public address, used for the QR codes. The browser sends its own address with the request;
// PORTAL_URL (env) is the fallback. Returns an "https://host" origin, or null when there is no usable address
// (the sheet is then built without QR codes).
function resolvePortalUrl(candidate) {
  for (const raw of [candidate, process.env.PORTAL_URL]) {
    if (!raw || typeof raw !== 'string') continue;
    try {
      const url = new URL(raw.trim());
      if (url.protocol === 'http:' || url.protocol === 'https:') return url.origin;
    } catch { /* try the next one */ }
  }
  return null;
}

// The link a login QR code opens: the portal, with the username and password in the #fragment.
// A fragment is never sent to the server (so it stays out of server and proxy logs) — the login page
// reads it in the browser, fills the form and removes it from the address bar.
function loginLink(portalUrl, username, password) {
  return `${portalUrl}/#${new URLSearchParams({ u: username, p: password })}`;
}

const QR_PX = 120; // size of a QR code in the sheet, in pixels
const QR_ROW_PT = 96; // row height in points (96pt = 128px) so the code fits with a margin

// Builds the "Logins" workbook shared by every login sheet (teachers and students).
// rows: [{ name, username, password, role, grade, classroomSection }]
// opts.portalUrl: when given (and valid), a QR column is added — scanning it opens the portal with the
// username and password already filled in.
// Returns the .xlsx as a Buffer.
async function buildCredentialsBuffer(rows, opts = {}) {
  const portalUrl = resolvePortalUrl(opts.portalUrl);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Logins');
  const columns = [
    { header: 'Name', key: 'name', width: 28 },
    { header: 'Username', key: 'username', width: 24 },
    { header: 'Password', key: 'password', width: 14 },
    { header: 'Role', key: 'role', width: 10 },
    { header: 'Grade', key: 'grade', width: 12 },
    { header: 'Classroom', key: 'classroomSection', width: 12 }
  ];
  if (portalUrl) columns.push({ header: 'QR code', key: 'qr', width: 20 });
  sheet.columns = columns;
  sheet.getRow(1).font = { bold: true };
  // printing: landscape, everything (QR column included) fitted to the page width
  sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  for (const [i, r] of rows.entries()) {
    const row = sheet.addRow({
      name: r.name,
      username: r.username,
      password: r.password,
      role: r.role,
      grade: r.grade || '',
      classroomSection: r.classroomSection || ''
    });
    if (!portalUrl) continue;

    row.height = QR_ROW_PT;
    row.alignment = { vertical: 'middle' };
    const png = await QRCode.toBuffer(loginLink(portalUrl, r.username, r.password), {
      type: 'png', errorCorrectionLevel: 'M', margin: 2, width: QR_PX * 2
    });
    const imageId = workbook.addImage({ buffer: png, extension: 'png' });
    // row i of the data is sheet row i + 2 (row 1 is the header); image positions are 0-based
    sheet.addImage(imageId, { tl: { col: columns.length - 1 + 0.1, row: i + 1 + 0.05 }, ext: { width: QR_PX, height: QR_PX } });
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

module.exports = { slugifyName, generateSimplePassword, makeUniqueUsername, buildCredentialsBuffer, resolvePortalUrl };
