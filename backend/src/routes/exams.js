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

// GET /api/exams/subject/:id — list exams for a subject (both roles)
router.get('/subject/:id', requireAuth, async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM exams WHERE subject_id = $1 ORDER BY exam_date',
    [req.params.id]
  );
  res.json(result.rows);
});

module.exports = router;
