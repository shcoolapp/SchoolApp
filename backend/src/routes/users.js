const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');
const pool = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');
const { isValidGrade, isValidClassroom, GRADES, CLASSROOMS } = require('../utils/schoolStructure');
const { slugifyName, generateSimplePassword, makeUniqueUsername, buildCredentialsBuffer } = require('../utils/credentials');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

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
// Expects an .xlsx file with columns: name | role | grade | classroom section
//
// No email or password columns: a username is generated from the name and a simple
// 4-character password (2 letters + 2 digits) is generated for every row, teachers and students alike.
// grade + classroom section are required for students (used to auto-enroll them) and ignored for teachers.
//
// The response includes a `credentialsFile` (base64 .xlsx) listing every generated
// username + password (both teachers and students), so the admin can print/hand these out.
router.post('/import', requireAuth, requireRole('admin'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const sheet = workbook.worksheets[0];

    const results = { created: 0, skipped: 0, enrolled: 0, errors: [] };
    const generatedCredentials = []; // { name, username, password, role, grade, classroomSection }

    for (let i = 2; i <= sheet.rowCount; i++) { // row 1 = headers
      const row = sheet.getRow(i);
      const name = row.getCell(1).text?.trim();
      const rawRole = row.getCell(2).text?.trim();
      const role = normalizeRole(rawRole);
      const sheetGrade = row.getCell(3).text?.trim() || null;
      const sheetClassroom = row.getCell(4).text?.trim() || null;

      if (!name || !rawRole) continue; // skip blank rows

      if (!role) {
        results.errors.push(`Row ${i}: invalid role "${rawRole}"`);
        continue;
      }

      if (role === 'student' && (!sheetGrade || !sheetClassroom)) {
        results.errors.push(`Row ${i}: student rows require grade and classroom section`);
        continue;
      }

      if (role === 'student' && !isValidGrade(sheetGrade)) {
        results.errors.push(`Row ${i}: invalid grade "${sheetGrade}" — must be one of: ${GRADES.join(', ')}`);
        continue;
      }

      if (role === 'student' && !isValidClassroom(sheetClassroom)) {
        results.errors.push(`Row ${i}: invalid classroom "${sheetClassroom}" — must be one of: ${CLASSROOMS.join(', ')}`);
        continue;
      }

      // Teachers aren't tied to one grade/classroom (a subject is), so those cells are ignored for them.
      const grade = role === 'student' ? sheetGrade : null;
      const classroomSection = role === 'student' ? sheetClassroom : null;

      const username = await makeUniqueUsername(slugifyName(name));
      const finalPassword = generateSimplePassword();
      generatedCredentials.push({ name, username, password: finalPassword, role, grade: grade || '', classroomSection: classroomSection || '' });

      const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
      if (existing.rows.length > 0) {
        results.skipped++;
        continue;
      }

      const passwordHash = await bcrypt.hash(finalPassword, 10);
      const inserted = await pool.query(
        'INSERT INTO users (name, username, password_hash, plaintext_password, role, grade, classroom_section) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
        [name, username, passwordHash, finalPassword, role, grade, classroomSection]
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
      const buffer = await buildCredentialsBuffer(generatedCredentials);
      credentialsFileBase64 = Buffer.from(buffer).toString('base64');
    }

    res.json({ ...results, credentialsFile: credentialsFileBase64 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process file' });
  }
});

// ---- Student import, one classroom at a time (School tab) ----
// The admin picks the grade + classroom, uploads a sheet of names, reviews/edits the list in the browser,
// then saves it. The sheet only holds names: grade and classroom come from the form.

const MAX_STUDENTS_PER_IMPORT = 200;
const HEADER_WORDS = new Set(['name', 'names', 'student', 'students', 'student name', 'full name', 'الاسم', 'اسم', 'اسم الطالب', 'الطالب', 'الطلاب']);
const cleanName = (v) => String(v ?? '').trim().replace(/\s+/g, ' ');

// POST /api/users/students/preview — reads the first column of an .xlsx and returns the names. Saves nothing.
router.post('/students/preview', requireAuth, requireRole('admin'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) return res.status(400).json({ error: 'The file has no sheets' });

    const names = [];
    for (let i = 1; i <= sheet.rowCount; i++) {
      const text = cleanName(sheet.getRow(i).getCell(1).text);
      if (!text) continue;
      if (i === 1 && HEADER_WORDS.has(text.toLowerCase())) continue; // header row
      names.push(text);
    }
    if (names.length > MAX_STUDENTS_PER_IMPORT) {
      return res.status(400).json({ error: `A classroom import is limited to ${MAX_STUDENTS_PER_IMPORT} students` });
    }
    res.json({ names });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Could not read the file — upload an .xlsx spreadsheet' });
  }
});

// GET /api/users/students?grade=X&classroomSection=Y — students already in a classroom
router.get('/students', requireAuth, requireRole('admin'), async (req, res) => {
  const { grade, classroomSection } = req.query;
  if (!isValidGrade(grade) || !isValidClassroom(classroomSection)) {
    return res.status(400).json({ error: 'Choose a valid grade and classroom' });
  }
  const result = await pool.query(
    "SELECT id, name, username FROM users WHERE role = 'student' AND grade = $1 AND classroom_section = $2 ORDER BY name",
    [grade, classroomSection]
  );
  res.json(result.rows);
});

// POST /api/users/students/import — saves the reviewed list into one classroom.
// body: { grade, classroomSection, names: [string] }
// A username + simple password is generated for each new student and the student is enrolled in the
// subjects of that classroom. Names already in the classroom (or repeated in the list) are skipped, so
// uploading the same sheet twice never creates duplicates. Returns a base64 login sheet for the new students.
router.post('/students/import', requireAuth, requireRole('admin'), async (req, res) => {
  const { grade, classroomSection } = req.body;
  if (!isValidGrade(grade)) return res.status(400).json({ error: `Invalid grade. Must be one of: ${GRADES.join(', ')}` });
  if (!isValidClassroom(classroomSection)) return res.status(400).json({ error: `Invalid classroom. Must be one of: ${CLASSROOMS.join(', ')}` });

  const names = (Array.isArray(req.body.names) ? req.body.names : []).map(cleanName).filter(Boolean);
  if (names.length === 0) return res.status(400).json({ error: 'There are no students to save' });
  if (names.length > MAX_STUDENTS_PER_IMPORT) return res.status(400).json({ error: `A classroom import is limited to ${MAX_STUDENTS_PER_IMPORT} students` });
  if (names.some((n) => n.length > 150)) return res.status(400).json({ error: 'A student name is too long' });

  try {
    const existing = await pool.query(
      "SELECT name FROM users WHERE role = 'student' AND grade = $1 AND classroom_section = $2",
      [grade, classroomSection]
    );
    const taken = new Set(existing.rows.map((r) => cleanName(r.name).toLowerCase()));

    const results = { created: 0, skipped: 0, enrolled: 0, errors: [] };
    const credentials = [];

    for (const name of names) {
      const key = name.toLowerCase();
      if (taken.has(key)) { results.skipped++; continue; }
      taken.add(key);

      const username = await makeUniqueUsername(slugifyName(name) || 'student');
      const password = generateSimplePassword();
      const passwordHash = await bcrypt.hash(password, 10);
      const inserted = await pool.query(
        `INSERT INTO users (name, username, password_hash, plaintext_password, role, grade, classroom_section)
         VALUES ($1, $2, $3, $4, 'student', $5, $6) RETURNING id`,
        [name, username, passwordHash, password, grade, classroomSection]
      );
      results.created++;
      credentials.push({ name, username, password, role: 'student', grade, classroomSection });

      const enrolled = await pool.query(
        `INSERT INTO enrollments (student_id, subject_id)
         SELECT $1, id FROM subjects WHERE grade = $2 AND classroom_section = $3
         ON CONFLICT DO NOTHING`,
        [inserted.rows[0].id, grade, classroomSection]
      );
      results.enrolled += enrolled.rowCount;
    }

    let credentialsFile = null;
    if (credentials.length > 0) {
      credentialsFile = (await buildCredentialsBuffer(credentials)).toString('base64');
    }

    res.json({ ...results, credentialsFile });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save the students' });
  }
});

// GET /api/users/credentials?role=student|teacher|all&grade=X&classroomSection=Y
// Admin re-downloads an Excel of username/password logins at any time, not just at import time.
// role defaults to students; grade / classroomSection only narrow the student list (teachers have neither).
router.get('/credentials', requireAuth, requireRole('admin'), async (req, res) => {
  const { grade, classroomSection } = req.query;
  const role = req.query.role || 'student';
  if (!['student', 'teacher', 'all'].includes(role)) {
    return res.status(400).json({ error: 'role must be student, teacher or all' });
  }

  try {
    let query = `SELECT name, username, plaintext_password, role, grade, classroom_section
                 FROM users WHERE plaintext_password IS NOT NULL AND role IN ('student', 'teacher')`;
    const params = [];

    if (role !== 'all') {
      params.push(role);
      query += ` AND role = $${params.length}`;
    }
    if (grade) {
      params.push(grade);
      query += ` AND grade = $${params.length}`;
    }
    if (classroomSection) {
      params.push(classroomSection);
      query += ` AND classroom_section = $${params.length}`;
    }
    query += ' ORDER BY role DESC, grade, classroom_section, name'; // teachers first, then students by class

    const result = await pool.query(query, params);
    const buffer = await buildCredentialsBuffer(
      result.rows.map((r) => ({
        name: r.name,
        username: r.username,
        password: r.plaintext_password,
        role: r.role,
        grade: r.grade,
        classroomSection: r.classroom_section
      }))
    );

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${role}-logins.xlsx"`);
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to build the login sheet' });
  }
});

module.exports = router;

// PUT /api/users/me — any logged-in user updates their own name/username/password.
// Changing the password requires supplying the current one first.
router.put('/me', requireAuth, async (req, res) => {
  const { name, username, currentPassword, newPassword } = req.body;

  const existing = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  const me = existing.rows[0];
  if (!me) return res.status(404).json({ error: 'Account not found' });

  const updates = [];
  const values = [];
  let paramIndex = 1;

  if (name && name.trim()) {
    updates.push(`name = $${paramIndex++}`);
    values.push(name.trim());
  }

  if (username && username.trim() && username.trim() !== me.username) {
    const clash = await pool.query('SELECT id FROM users WHERE username = $1 AND id != $2', [username.trim(), req.user.id]);
    if (clash.rows.length > 0) return res.status(409).json({ error: 'Username already taken' });
    updates.push(`username = $${paramIndex++}`);
    values.push(username.trim());
  }

  if (newPassword) {
    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password required to set a new password' });
    }
    const match = await bcrypt.compare(currentPassword, me.password_hash);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });

    const newHash = await bcrypt.hash(newPassword, 10);
    updates.push(`password_hash = $${paramIndex++}`);
    values.push(newHash);
    // Keep plaintext_password in sync if this account has one (students/teachers
    // whose credentials are re-downloadable by an admin) — admins don't have one.
    if (me.plaintext_password !== null) {
      updates.push(`plaintext_password = $${paramIndex++}`);
      values.push(newPassword);
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  values.push(req.user.id);
  await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`, values);

  const updated = await pool.query('SELECT id, name, username, role, grade, classroom_section FROM users WHERE id = $1', [req.user.id]);
  res.json(updated.rows[0]);
});
