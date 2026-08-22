const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');
const pool = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Turns a full name into a lowercase, no-space username base, e.g. "Ali Hassan" -> "ali_hassan"
function slugifyName(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF\s]/g, '') // keep letters/numbers/Arabic script, drop punctuation
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
async function makeUniqueUsername(base) {
  let candidate = base;
  let suffix = 1;
  while (true) {
    const existing = await pool.query('SELECT id FROM users WHERE username = $1', [candidate]);
    if (existing.rows.length === 0) return candidate;
    suffix += 1;
    candidate = `${base}${suffix}`;
  }
}

// POST /api/users/import
// Expects an .xlsx file with columns: name | email | role | password | grade | classroomSection
//
// Teachers: email + password required (they log in with email, same as before).
// Students: email/password columns are ignored if present — a username is auto-generated
// from their name, and a simple 4-character password (2 letters + 2 digits) is generated.
// grade + classroomSection are required for students, used to auto-enroll them.
//
// The response includes a `credentialsFile` (base64 .xlsx) listing every generated
// student username + password, so the teacher can print/hand these out.
router.post('/import', requireAuth, requireRole('teacher'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const sheet = workbook.worksheets[0];

    const results = { created: 0, skipped: 0, enrolled: 0, errors: [] };
    const generatedCredentials = []; // { name, username, password, grade, classroomSection }

    for (let i = 2; i <= sheet.rowCount; i++) { // row 1 = headers
      const row = sheet.getRow(i);
      const name = row.getCell(1).text?.trim();
      const email = row.getCell(2).text?.trim();
      const role = row.getCell(3).text?.trim().toLowerCase();
      const password = row.getCell(4).text?.trim();
      const grade = row.getCell(5).text?.trim() || null;
      const classroomSection = row.getCell(6).text?.trim() || null;

      if (!name || !role) continue; // skip blank rows

      if (!['teacher', 'student'].includes(role)) {
        results.errors.push(`Row ${i}: invalid role "${role}"`);
        continue;
      }

      if (role === 'student' && (!grade || !classroomSection)) {
        results.errors.push(`Row ${i}: student rows require grade and classroomSection`);
        continue;
      }

      if (role === 'teacher' && (!email || !password)) {
        results.errors.push(`Row ${i}: teacher rows require email and password`);
        continue;
      }

      let username, finalPassword, finalEmail;

      if (role === 'student') {
        username = await makeUniqueUsername(slugifyName(name));
        finalPassword = generateSimplePassword();
        finalEmail = email || null; // optional for students
        generatedCredentials.push({ name, username, password: finalPassword, grade, classroomSection });
      } else {
        // Teachers keep using their own email as a de-facto username too, so the
        // single `username` login field still works for them.
        username = await makeUniqueUsername(email.split('@')[0]);
        finalPassword = password;
        finalEmail = email;
      }

      const existing = await pool.query(
        'SELECT id FROM users WHERE username = $1 OR (email IS NOT NULL AND email = $2)',
        [username, finalEmail]
      );
      if (existing.rows.length > 0) {
        results.skipped++;
        continue;
      }

      const passwordHash = await bcrypt.hash(finalPassword, 10);
      const plaintextToStore = role === 'student' ? finalPassword : null;
      const inserted = await pool.query(
        'INSERT INTO users (name, username, email, password_hash, plaintext_password, role, grade, classroom_section) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
        [name, username, finalEmail, passwordHash, plaintextToStore, role, grade, classroomSection]
      );
      results.created++;

      if (role === 'student') {
        const studentId = inserted.rows[0].id;
        const matchingSubjects = await pool.query(
          'SELECT id FROM subjects WHERE grade = $1 AND classroom_section = $2',
          [grade, classroomSection]
        );
        for (const subject of matchingSubjects.rows) {
          await pool.query(
            'INSERT INTO enrollments (student_id, subject_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [studentId, subject.id]
          );
          results.enrolled++;
        }
      }
    }

    // Build a downloadable credentials sheet for the generated student logins.
    let credentialsFileBase64 = null;
    if (generatedCredentials.length > 0) {
      const outWorkbook = new ExcelJS.Workbook();
      const outSheet = outWorkbook.addWorksheet('Student Logins');
      outSheet.columns = [
        { header: 'Name', key: 'name' },
        { header: 'Username', key: 'username' },
        { header: 'Password', key: 'password' },
        { header: 'Grade', key: 'grade' },
        { header: 'Classroom', key: 'classroomSection' }
      ];
      generatedCredentials.forEach((c) => outSheet.addRow(c));
      const buffer = await outWorkbook.xlsx.writeBuffer();
      credentialsFileBase64 = Buffer.from(buffer).toString('base64');
    }

    res.json({ ...results, credentialsFile: credentialsFileBase64 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process file' });
  }
});

// GET /api/users/credentials?grade=X&classroomSection=Y — teacher downloads an Excel
// of student username/password for a specific classroom, or all their students if
// grade/classroomSection are omitted. Available anytime, not just at import time.
router.get('/credentials', requireAuth, requireRole('teacher'), async (req, res) => {
  const { grade, classroomSection } = req.query;

  let query = `SELECT name, username, plaintext_password, grade, classroom_section
               FROM users WHERE role = 'student' AND plaintext_password IS NOT NULL`;
  const params = [];

  if (grade) {
    params.push(grade);
    query += ` AND grade = $${params.length}`;
  }
  if (classroomSection) {
    params.push(classroomSection);
    query += ` AND classroom_section = $${params.length}`;
  }
  query += ' ORDER BY grade, classroom_section, name';

  const result = await pool.query(query, params);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Student Logins');
  sheet.columns = [
    { header: 'Name', key: 'name' },
    { header: 'Username', key: 'username' },
    { header: 'Password', key: 'password' },
    { header: 'Grade', key: 'grade' },
    { header: 'Classroom', key: 'classroomSection' }
  ];
  result.rows.forEach((r) =>
    sheet.addRow({
      name: r.name,
      username: r.username,
      password: r.plaintext_password,
      grade: r.grade,
      classroomSection: r.classroom_section
    })
  );

  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="student-logins.xlsx"');
  res.send(buffer);
});

module.exports = router;
