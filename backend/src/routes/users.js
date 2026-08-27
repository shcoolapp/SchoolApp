const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');
const pool = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');
const { isValidGrade, isValidClassroom, GRADES, CLASSROOMS } = require('../utils/schoolStructure');

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

// Maps common Arabic role labels to the internal English role values.
// Lets teachers upload rosters exactly as they already have them, without
// manually retyping the role column in English first.
const ROLE_ALIASES = {
  'teacher': 'teacher',
  'معلم': 'teacher',
  'معلمة': 'teacher',
  'مدرس': 'teacher',
  'مدرسة': 'teacher',
  'أستاذ': 'teacher',
  'استاذ': 'teacher',
  'أستاذة': 'teacher',
  'استاذة': 'teacher',
  'student': 'student',
  'طالب': 'student',
  'طالبة': 'student'
};

function normalizeRole(raw) {
  const key = raw?.trim().toLowerCase();
  return ROLE_ALIASES[key] || null;
}

// POST /api/users/import
// Expects an .xlsx file with columns: name | email | role | password | grade | classroomSection
//
// Both teachers and students: email/password columns are optional and ignored if present —
// a username is auto-generated from their name, and a simple 4-character password
// (2 letters + 2 digits) is generated automatically. No Gmail/email account required for anyone.
// grade + classroomSection are required for students, used to auto-enroll them.
//
// The response includes a `credentialsFile` (base64 .xlsx) listing every generated
// username + password (both teachers and students), so the admin can print/hand these out.
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
      const rawRole = row.getCell(3).text?.trim();
      const role = normalizeRole(rawRole);
      const password = row.getCell(4).text?.trim();
      const grade = row.getCell(5).text?.trim() || null;
      const classroomSection = row.getCell(6).text?.trim() || null;

      if (!name || !rawRole) continue; // skip blank rows

      if (!role) {
        results.errors.push(`Row ${i}: invalid role "${rawRole}"`);
        continue;
      }

      if (role === 'student' && (!grade || !classroomSection)) {
        results.errors.push(`Row ${i}: student rows require grade and classroomSection`);
        continue;
      }

      if (role === 'student' && !isValidGrade(grade)) {
        results.errors.push(`Row ${i}: invalid grade "${grade}" — must be one of: ${GRADES.join(', ')}`);
        continue;
      }

      if (role === 'student' && !isValidClassroom(classroomSection)) {
        results.errors.push(`Row ${i}: invalid classroom "${classroomSection}" — must be one of: ${CLASSROOMS.join(', ')}`);
        continue;
      }

      let username, finalPassword, finalEmail;

      if (role === 'student') {
        username = await makeUniqueUsername(slugifyName(name));
        finalPassword = generateSimplePassword();
        finalEmail = email || null;
        generatedCredentials.push({ name, username, password: finalPassword, role, grade, classroomSection });
      } else {
        // Teachers now also get an auto-generated username/password, same as students —
        // no email account required. If a password was supplied in the sheet, honor it;
        // otherwise generate one.
        username = await makeUniqueUsername(slugifyName(name));
        finalPassword = password || generateSimplePassword();
        finalEmail = email || null;
        generatedCredentials.push({ name, username, password: finalPassword, role, grade: '', classroomSection: '' });
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
      const inserted = await pool.query(
        'INSERT INTO users (name, username, email, password_hash, plaintext_password, role, grade, classroom_section) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
        [name, username, finalEmail, passwordHash, finalPassword, role, grade, classroomSection]
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

    // Build a downloadable credentials sheet for every generated login (teachers + students).
    let credentialsFileBase64 = null;
    if (generatedCredentials.length > 0) {
      const outWorkbook = new ExcelJS.Workbook();
      const outSheet = outWorkbook.addWorksheet('Logins');
      outSheet.columns = [
        { header: 'Name', key: 'name' },
        { header: 'Username', key: 'username' },
        { header: 'Password', key: 'password' },
        { header: 'Role', key: 'role' },
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

// GET /api/users/credentials?role=student&grade=X&classroomSection=Y — teacher downloads
// an Excel of username/password logins. Defaults to students only if no role given;
// pass role=teacher to get teacher logins, or role=all for everyone. Available anytime,
// not just at import time.
router.get('/credentials', requireAuth, requireRole('teacher'), async (req, res) => {
  const { grade, classroomSection, role } = req.query;

  let query = `SELECT name, username, plaintext_password, role, grade, classroom_section
               FROM users WHERE plaintext_password IS NOT NULL`;
  const params = [];

  if (!role || role === 'student') {
    params.push('student');
    query += ` AND role = $${params.length}`;
  } else if (role === 'teacher') {
    params.push('teacher');
    query += ` AND role = $${params.length}`;
  }
  // role=all: no role filter added

  if (grade) {
    params.push(grade);
    query += ` AND grade = $${params.length}`;
  }
  if (classroomSection) {
    params.push(classroomSection);
    query += ` AND classroom_section = $${params.length}`;
  }
  query += ' ORDER BY role, grade, classroom_section, name';

  const result = await pool.query(query, params);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Logins');
  sheet.columns = [
    { header: 'Name', key: 'name' },
    { header: 'Username', key: 'username' },
    { header: 'Password', key: 'password' },
    { header: 'Role', key: 'role' },
    { header: 'Grade', key: 'grade' },
    { header: 'Classroom', key: 'classroomSection' }
  ];
  result.rows.forEach((r) =>
    sheet.addRow({
      name: r.name,
      username: r.username,
      password: r.plaintext_password,
      role: r.role,
      grade: r.grade,
      classroomSection: r.classroom_section
    })
  );

  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="logins.xlsx"');
  res.send(buffer);
});

module.exports = router;
