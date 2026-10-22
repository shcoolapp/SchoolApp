const express = require('express');
const pool = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');
const { notifySubjectStudents, notifyAudience } = require('../utils/notify');

const router = express.Router();

// POST /api/announcements
//  teacher: { subjectId, title, body }            -> students enrolled in that subject
//  admin:   { title, body, grade?, classroomSection? } -> all students / one grade / one section
router.post('/', requireAuth, requireRole('teacher', 'admin'), async (req, res) => {
  const { subjectId, title, body, grade, classroomSection } = req.body;
  if (!title || !String(title).trim()) return res.status(400).json({ error: 'Title is required' });

  let row;
  if (req.user.role === 'teacher') {
    const subject = await pool.query('SELECT * FROM subjects WHERE id = $1 AND teacher_id = $2', [subjectId, req.user.id]);
    if (subject.rows.length === 0) return res.status(404).json({ error: 'Subject not found or not yours' });
    row = (await pool.query(
      'INSERT INTO announcements (author_id, subject_id, title, body) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user.id, subjectId, title.trim(), body || null]
    )).rows[0];
    await notifySubjectStudents(subjectId, { type: 'announcement', title: title.trim(), body, refId: row.id });
  } else {
    row = (await pool.query(
      'INSERT INTO announcements (author_id, grade, classroom_section, title, body) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.user.id, grade || null, grade ? classroomSection || null : null, title.trim(), body || null]
    )).rows[0];
    await notifyAudience(row.grade, row.classroom_section, { type: 'announcement', title: title.trim(), body, refId: row.id });
  }
  res.status(201).json(row);
});

// GET /api/announcements — what the signed-in user should see
router.get('/', requireAuth, async (req, res) => {
  const base = `SELECT a.*, u.name AS author_name, s.name AS subject_name
                FROM announcements a
                JOIN users u ON u.id = a.author_id
                LEFT JOIN subjects s ON s.id = a.subject_id`;
  let result;
  if (req.user.role === 'admin') {
    result = await pool.query(`${base} ORDER BY a.created_at DESC LIMIT 100`);
  } else if (req.user.role === 'teacher') {
    result = await pool.query(`${base} WHERE a.author_id = $1 OR (a.subject_id IS NULL) ORDER BY a.created_at DESC LIMIT 100`, [req.user.id]);
  } else {
    result = await pool.query(
      `${base}
       WHERE a.subject_id IN (SELECT subject_id FROM enrollments WHERE student_id = $1)
          OR (a.subject_id IS NULL
              AND (a.grade IS NULL OR a.grade = (SELECT grade FROM users WHERE id = $1))
              AND (a.classroom_section IS NULL OR a.classroom_section = (SELECT classroom_section FROM users WHERE id = $1)))
       ORDER BY a.created_at DESC LIMIT 100`,
      [req.user.id]
    );
  }
  res.json(result.rows);
});

// DELETE /api/announcements/:id — author or admin
router.delete('/:id', requireAuth, requireRole('teacher', 'admin'), async (req, res) => {
  const result = req.user.role === 'admin'
    ? await pool.query('DELETE FROM announcements WHERE id = $1 RETURNING id', [req.params.id])
    : await pool.query('DELETE FROM announcements WHERE id = $1 AND author_id = $2 RETURNING id', [req.params.id, req.user.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found or not yours' });
  await pool.query("DELETE FROM notifications WHERE type = 'announcement' AND ref_id = $1", [req.params.id]);
  res.json({ deleted: true });
});

module.exports = router;
