const express = require('express');
const pool = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// POST /api/todos — teacher adds a to-do/activity item for one of their subjects
router.post('/', requireAuth, requireRole('teacher'), async (req, res) => {
  const { subjectId, activityDate, description } = req.body;

  const subject = await pool.query('SELECT * FROM subjects WHERE id = $1 AND teacher_id = $2', [subjectId, req.user.id]);
  if (subject.rows.length === 0) return res.status(404).json({ error: 'Subject not found or not yours' });

  const result = await pool.query(
    'INSERT INTO todos (teacher_id, subject_id, activity_date, description) VALUES ($1, $2, $3, $4) RETURNING *',
    [req.user.id, subjectId, activityDate, description]
  );
  res.status(201).json(result.rows[0]);
});

// GET /api/todos/me — teacher sees their own items, student sees items for enrolled subjects
// Optional query params: month=YYYY-MM to filter for calendar view
router.get('/me', requireAuth, async (req, res) => {
  const { month } = req.query; // e.g. "2026-09"

  if (month && !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'Invalid month format, expected YYYY-MM' });
  }

  if (req.user.role === 'teacher') {
    const result = await pool.query(
      `SELECT t.*, s.name AS subject_name FROM todos t
       JOIN subjects s ON s.id = t.subject_id
       WHERE t.teacher_id = $1 AND ($2::text IS NULL OR to_char(t.activity_date, 'YYYY-MM') = $2)
       ORDER BY t.activity_date`,
      [req.user.id, month || null]
    );
    return res.json(result.rows);
  }

  const result = await pool.query(
    `SELECT t.*, s.name AS subject_name FROM todos t
     JOIN subjects s ON s.id = t.subject_id
     JOIN enrollments e ON e.subject_id = t.subject_id
     WHERE e.student_id = $1 AND ($2::text IS NULL OR to_char(t.activity_date, 'YYYY-MM') = $2)
     ORDER BY t.activity_date`,
    [req.user.id, month || null]
  );
  res.json(result.rows);
});

// DELETE /api/todos/:id — teacher removes their own to-do item
router.delete('/:id', requireAuth, requireRole('teacher'), async (req, res) => {
  const result = await pool.query(
    'DELETE FROM todos WHERE id = $1 AND teacher_id = $2 RETURNING *',
    [req.params.id, req.user.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found or not yours' });
  res.json({ deleted: true });
});

module.exports = router;
