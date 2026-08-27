const express = require('express');
const pool = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// POST /api/exams — teacher posts exam info for their subject
router.post('/', requireAuth, requireRole('teacher'), async (req, res) => {
  const { subjectId, examDate, examTime, scope } = req.body;

  const subject = await pool.query('SELECT * FROM subjects WHERE id = $1 AND teacher_id = $2', [subjectId, req.user.id]);
  if (subject.rows.length === 0) return res.status(404).json({ error: 'Subject not found or not yours' });

  const result = await pool.query(
    'INSERT INTO exams (subject_id, exam_date, exam_time, scope) VALUES ($1, $2, $3, $4) RETURNING *',
    [subjectId, examDate, examTime, scope]
  );
  res.status(201).json(result.rows[0]);
});

// GET /api/exams/subject/:id — list exams for a subject (teacher who owns it, or enrolled student)
router.get('/subject/:id', requireAuth, async (req, res) => {
  const subjectId = req.params.id;

  if (req.user.role === 'teacher') {
    const owns = await pool.query('SELECT id FROM subjects WHERE id = $1 AND teacher_id = $2', [subjectId, req.user.id]);
    if (owns.rows.length === 0) return res.status(403).json({ error: 'Not your subject' });
  } else {
    const enrolled = await pool.query('SELECT id FROM enrollments WHERE subject_id = $1 AND student_id = $2', [subjectId, req.user.id]);
    if (enrolled.rows.length === 0) return res.status(403).json({ error: 'Not enrolled in this subject' });
  }

  const result = await pool.query(
    'SELECT * FROM exams WHERE subject_id = $1 ORDER BY exam_date',
    [subjectId]
  );
  res.json(result.rows);
});

module.exports = router;
