const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');
const { GRADES, CLASSROOMS, isValidGrade, isValidClassroom } = require('../utils/schoolStructure');
const { slugifyName, generateSimplePassword, makeUniqueUsername, buildCredentialsBuffer } = require('../utils/credentials');

const router = express.Router();

// Case/space-insensitive key for matching teacher names
const nameKey = (v) => String(v ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

// GET /api/subjects/structure — returns the canonical grade/classroom lists,
// so the frontend can render dropdowns instead of free-text fields.
router.get('/structure', requireAuth, (req, res) => {
  res.json({ grades: GRADES, classrooms: CLASSROOMS });
});

// GET /api/subjects/overview — admin: every subject grouped for the School tab.
// One row = one subject name taught by one teacher in one grade, with the classrooms it covers:
//   Math / Mohammed / 1 Mid / [A, B, C]. `ids` are the underlying subject records (one per classroom).
router.get('/overview', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const teachers = await pool.query("SELECT id, name, username FROM users WHERE role = 'teacher' ORDER BY name");
    const subjects = await pool.query('SELECT id, name, grade, classroom_section, teacher_id FROM subjects');

    const groups = new Map();
    for (const s of subjects.rows) {
      const key = `${s.grade}|${s.teacher_id}|${s.name}`;
      if (!groups.has(key)) groups.set(key, { ids: [], name: s.name, teacherId: s.teacher_id, grade: s.grade, sections: [] });
      const g = groups.get(key);
      g.ids.push(s.id);
      g.sections.push(s.classroom_section);
    }
    const rows = [...groups.values()]
      .map((g) => ({ ...g, sections: [...g.sections].sort() }))
      .sort((a, b) => GRADES.indexOf(a.grade) - GRADES.indexOf(b.grade) || a.name.localeCompare(b.name));

    res.json({ teachers: teachers.rows, rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load the school overview' });
  }
});

// POST /api/subjects/sync — admin saves the School tab (and the bulk assignment) in one go.
// body: { dryRun?, returnCredentials?, rows: [{ clientId, ids: [subjectId...], name, teacherId, newTeacherName?, grade, sections: ['A','B'] }], deleteIds: [subjectId...] }
//
// A row names its teacher with `teacherId`, or with `newTeacherName` (a teacher read from an Excel sheet who has no
// account yet). A new name is matched to an existing teacher of that name, otherwise the teacher is created in this
// same transaction with a generated username + simple password. With `returnCredentials` the response carries a
// base64 .xlsx login sheet (`credentialsFile`) of every teacher used by the saved rows.
//
// A row with `ids` edits existing subject records, a row without creates new ones:
//  - same grade, classroom kept       -> the record is updated in place (name / teacher); homework, marks, exams stay
//  - classroom dropped, or grade changed -> that record is deleted (with its homework, marks, exams, to-dos)
//  - classroom added                  -> a new record, and the students already in that class are enrolled
// Everything runs in one transaction. `dryRun` runs it all and rolls back, so the client can show what would be
// deleted (`deletions`) before the admin confirms. Any row problem answers 400 with `errors` and saves nothing.
router.post('/sync', requireAuth, requireRole('admin'), async (req, res) => {
  const dryRun = req.body.dryRun === true;
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  const deleteIds = new Set((Array.isArray(req.body.deleteIds) ? req.body.deleteIds : []).map(Number));
  if (rows.length > 500) return res.status(400).json({ error: 'Too many rows in one save' });
  if ([...deleteIds].some((id) => !Number.isInteger(id))) return res.status(400).json({ error: 'Invalid delete list' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const teacherRows = (await client.query("SELECT id, name FROM users WHERE role = 'teacher'")).rows;
    const teacherIds = new Set(teacherRows.map((r) => r.id));
    const teachersByName = new Map(); // name key -> [teacher ids]
    for (const tr of teacherRows) {
      const k = nameKey(tr.name);
      teachersByName.set(k, [...(teachersByName.get(k) || []), tr.id]);
    }
    const newTeachers = new Map(); // name key -> id of the teacher created during this save
    const createdLogins = []; // login rows of the teachers created during this save
    const errors = [];
    const fail = (clientId, message) => {
      if (!errors.some((e) => e.clientId === clientId && e.message === message)) errors.push({ clientId, message });
    };

    // 1) validate every row and work out what each one means
    const plans = [];
    const toDelete = new Set(deleteIds);
    for (const [i, raw] of rows.entries()) {
      const clientId = raw.clientId ?? i;
      const name = String(raw.name ?? '').trim().replace(/\s+/g, ' ');
      const grade = raw.grade;
      let teacherId = Number(raw.teacherId);
      const sections = [...new Set(Array.isArray(raw.sections) ? raw.sections : [])];
      const ids = [...new Set((Array.isArray(raw.ids) ? raw.ids : []).map(Number))];

      if (!name) { fail(clientId, 'Subject name is required'); continue; }
      if (name.length > 150) { fail(clientId, 'Subject name is too long'); continue; }
      if (!isValidGrade(grade)) { fail(clientId, `Invalid grade. Must be one of: ${GRADES.join(', ')}`); continue; }
      if (!teacherIds.has(teacherId)) {
        const newName = String(raw.newTeacherName ?? '').trim().replace(/\s+/g, ' ');
        if (!newName) { fail(clientId, 'Choose a teacher'); continue; }
        if (newName.length > 150) { fail(clientId, 'Teacher name is too long'); continue; }
        const key = nameKey(newName);
        const sameName = teachersByName.get(key) || [];
        if (sameName.length > 1) { fail(clientId, `More than one teacher is called "${newName}" — choose which one`); continue; }
        if (sameName.length === 1) {
          teacherId = sameName[0];
        } else if (newTeachers.has(key)) {
          teacherId = newTeachers.get(key); // the same new teacher appears on several rows
        } else {
          const username = await makeUniqueUsername(slugifyName(newName) || 'teacher', client);
          const password = generateSimplePassword();
          const passwordHash = await bcrypt.hash(password, 10);
          const inserted = await client.query(
            `INSERT INTO users (name, username, password_hash, plaintext_password, role)
             VALUES ($1, $2, $3, $4, 'teacher') RETURNING id`,
            [newName, username, passwordHash, password]
          );
          teacherId = inserted.rows[0].id;
          newTeachers.set(key, teacherId);
          createdLogins.push({ id: teacherId });
        }
        teacherIds.add(teacherId);
      }
      if (sections.length === 0 || !sections.every(isValidClassroom)) { fail(clientId, `Choose at least one classroom (${CLASSROOMS.join(', ')})`); continue; }
      if (ids.some((id) => !Number.isInteger(id))) { fail(clientId, 'Invalid row'); continue; }

      const existing = ids.length ? (await client.query('SELECT * FROM subjects WHERE id = ANY($1::int[])', [ids])).rows : [];
      if (existing.length !== ids.length) { fail(clientId, 'This row changed on the server — reload the page and try again'); continue; }

      plans.push({ clientId, name, grade, teacherId, sections, existing });
    }

    const keep = [];    // { record, name, teacherId } updated in place
    const inserts = []; // { clientId, name, grade, teacherId, section }
    for (const p of plans) {
      const sameGrade = p.existing.every((e) => e.grade === p.grade);
      const have = new Set();
      for (const e of p.existing) {
        if (sameGrade && p.sections.includes(e.classroom_section)) {
          keep.push({ record: e, name: p.name, teacherId: p.teacherId });
          have.add(e.classroom_section);
          toDelete.delete(e.id);
        } else {
          toDelete.add(e.id);
        }
      }
      for (const section of p.sections) {
        if (!have.has(section)) inserts.push({ clientId: p.clientId, name: p.name, grade: p.grade, teacherId: p.teacherId, section });
      }
    }

    // 2) what is about to be lost (counted before anything is deleted)
    const deletions = (await client.query(
      `SELECT s.id, s.name, s.grade, s.classroom_section AS section,
              (SELECT COUNT(*) FROM homework h WHERE h.subject_id = s.id)::int AS homework,
              (SELECT COUNT(*) FROM marks m WHERE m.subject_id = s.id)::int AS marks,
              (SELECT COUNT(*) FROM exams e WHERE e.subject_id = s.id)::int AS exams,
              (SELECT COUNT(*) FROM todos t WHERE t.subject_id = s.id)::int AS todos
       FROM subjects s WHERE s.id = ANY($1::int[]) ORDER BY s.grade, s.name, s.classroom_section`,
      [[...toDelete]]
    )).rows;

    // 3) apply: deletes first so a removed class can be re-created in the same save
    const out = { created: 0, updated: 0, skipped: 0, deleted: 0, enrolled: 0 };
    if (toDelete.size > 0) {
      const del = await client.query('DELETE FROM subjects WHERE id = ANY($1::int[])', [[...toDelete]]);
      out.deleted = del.rowCount;
    }
    for (const k of keep) {
      if (k.record.name === k.name && k.record.teacher_id === k.teacherId) continue;
      await client.query('UPDATE subjects SET name = $2, teacher_id = $3 WHERE id = $1', [k.record.id, k.name, k.teacherId]);
      if (k.record.teacher_id !== k.teacherId) {
        await client.query('UPDATE todos SET teacher_id = $2 WHERE subject_id = $1', [k.record.id, k.teacherId]); // the new teacher owns the to-dos
      }
      out.updated++;
    }
    for (const ins of inserts) {
      const added = await client.query(
        `INSERT INTO subjects (name, grade, classroom_section, teacher_id) VALUES ($1, $2, $3, $4)
         ON CONFLICT (name, grade, classroom_section, teacher_id) DO NOTHING RETURNING id`,
        [ins.name, ins.grade, ins.section, ins.teacherId]
      );
      if (added.rows.length === 0) { out.skipped++; continue; }
      out.created++;
      const enrolled = await client.query(
        `INSERT INTO enrollments (student_id, subject_id)
         SELECT u.id, $1 FROM users u WHERE u.role = 'student' AND u.grade = $2 AND u.classroom_section = $3
         ON CONFLICT DO NOTHING`,
        [added.rows[0].id, ins.grade, ins.section]
      );
      out.enrolled += enrolled.rowCount;
    }

    // 4) one teacher per subject per classroom (checked on the final state, so swapping teachers works)
    for (const p of plans) {
      for (const section of p.sections) {
        const c = await client.query(
          `SELECT COUNT(DISTINCT teacher_id)::int AS n FROM subjects
           WHERE lower(btrim(name)) = lower($1) AND grade = $2 AND classroom_section = $3`,
          [p.name, p.grade, section]
        );
        if (c.rows[0].n > 1) fail(p.clientId, `${p.name} · ${p.grade} ${section} would have more than one teacher`);
      }
    }

    if (errors.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Some rows need attention', errors });
    }

    // login sheet for every teacher used by the saved rows (new teachers and existing ones alike)
    let credentialsFile = null;
    if (!dryRun && req.body.returnCredentials === true) {
      const usedIds = [...new Set(plans.map((p) => p.teacherId))];
      const logins = (await client.query(
        "SELECT name, username, plaintext_password FROM users WHERE id = ANY($1::int[]) AND plaintext_password IS NOT NULL ORDER BY name",
        [usedIds]
      )).rows;
      if (logins.length > 0) {
        const buffer = await buildCredentialsBuffer(logins.map((l) => ({ name: l.name, username: l.username, password: l.plaintext_password, role: 'teacher' })));
        credentialsFile = buffer.toString('base64');
      }
    }

    await client.query(dryRun ? 'ROLLBACK' : 'COMMIT');
    res.json({ dryRun, ...out, teachersCreated: createdLogins.length, deletions, credentialsFile });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    if (err.code === '23505') return res.status(409).json({ error: 'Two rows describe the same subject, teacher and classroom' });
    res.status(500).json({ error: 'Failed to save the changes' });
  } finally {
    client.release();
  }
});

// POST /api/subjects — teacher creates a subject for one grade+classroom
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { name, grade, classroomSection } = req.body;
  if (!name || !grade || !classroomSection) {
    return res.status(400).json({ error: 'Subject name, grade, and classroom section are required' });
  }
  if (!isValidGrade(grade)) {
    return res.status(400).json({ error: `Invalid grade. Must be one of: ${GRADES.join(', ')}` });
  }
  if (!isValidClassroom(classroomSection)) {
    return res.status(400).json({ error: `Invalid classroom. Must be one of: ${CLASSROOMS.join(', ')}` });
  }

  try {
    const result = await pool.query(
      'INSERT INTO subjects (name, grade, classroom_section, teacher_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, grade, classroomSection, req.user.id]
    );
    const subject = result.rows[0];

    // Retroactively enroll any students already in this grade+classroom,
    // in case they were uploaded before this subject existed.
    const matchingStudents = await pool.query(
      "SELECT id FROM users WHERE role = 'student' AND grade = $1 AND classroom_section = $2",
      [grade, classroomSection]
    );
    for (const student of matchingStudents.rows) {
      await pool.query(
        'INSERT INTO enrollments (student_id, subject_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [student.id, subject.id]
      );
    }

    res.status(201).json(subject);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'You already have this subject for this grade and classroom' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/subjects — admin sees everything, teacher sees their own subjects, student sees enrolled subjects
router.get('/', requireAuth, async (req, res) => {
  if (req.user.role === 'admin') {
    const result = await pool.query('SELECT * FROM subjects ORDER BY grade, classroom_section, name');
    return res.json(result.rows);
  }
  if (req.user.role === 'teacher') {
    const result = await pool.query('SELECT * FROM subjects WHERE teacher_id = $1', [req.user.id]);
    return res.json(result.rows);
  }
  const result = await pool.query(
    `SELECT s.* FROM subjects s
     JOIN enrollments e ON e.subject_id = s.id
     WHERE e.student_id = $1`,
    [req.user.id]
  );
  res.json(result.rows);
});

// POST /api/subjects/:id/enroll — admin manually enrolls a student into a subject
router.post('/:id/enroll', requireAuth, requireRole('admin'), async (req, res) => {
  const { studentId } = req.body;
  const subjectId = req.params.id;

  const subject = await pool.query('SELECT * FROM subjects WHERE id = $1', [subjectId]);
  if (subject.rows.length === 0) return res.status(404).json({ error: 'Subject not found' });

  try {
    const result = await pool.query(
      'INSERT INTO enrollments (student_id, subject_id) VALUES ($1, $2) RETURNING *',
      [studentId, subjectId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Student already enrolled' });
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/subjects/:id/students — teacher lists students enrolled in their subject
router.get('/:id/students', requireAuth, requireRole('teacher'), async (req, res) => {
  const subjectId = req.params.id;

  const subject = await pool.query('SELECT * FROM subjects WHERE id = $1 AND teacher_id = $2', [subjectId, req.user.id]);
  if (subject.rows.length === 0) return res.status(404).json({ error: 'Subject not found or not yours' });

  const result = await pool.query(
    `SELECT u.id, u.name, u.username FROM users u
     JOIN enrollments e ON e.student_id = u.id
     WHERE e.subject_id = $1
     ORDER BY u.name`,
    [subjectId]
  );
  res.json(result.rows);
});

module.exports = router;
