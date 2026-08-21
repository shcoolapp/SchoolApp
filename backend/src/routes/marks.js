const express = require('express');
const pool = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// POST /api/marks — teacher enters a mark for a student in one of their subjects
router.post('/', requireAuth, requireRole('teacher'), async (req, res) => {
  const { studentId, subjectId, value, term, description } = req.body;

  const subject = await pool.query('SELECT * FROM subjects WHERE id = $1 AND teacher_id = $2', [subjectId, req.user.id]);
  if (subject.rows.length === 0) return res.status(404).json({ error: 'Subject not found or not yours' });

  const result = await pool.query(
    'INSERT INTO marks (student_id, subject_id, value, term, description) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [studentId, subjectId, value, term, description]
  );
  res.status(201).json(result.rows[0]);
});

// GET /api/marks/me — student views their own marks across all subjects
router.get('/me', requireAuth, requireRole('student'), async (req, res) => {
  const result = await pool.query(
    `SELECT m.*, s.name AS subject_name FROM marks m
     JOIN subjects s ON s.id = m.subject_id
     WHERE m.student_id = $1
     ORDER BY m.created_at DESC`,
    [req.user.id]
  );
  res.json(result.rows);
});

// GET /api/marks/subject/:id — teacher views all marks for one of their subjects
router.get('/subject/:id', requireAuth, requireRole('teacher'), async (req, res) => {
  const subjectId = req.params.id;
  const subject = await pool.query('SELECT * FROM subjects WHERE id = $1 AND teacher_id = $2', [subjectId, req.user.id]);
  if (subject.rows.length === 0) return res.status(404).json({ error: 'Subject not found or not yours' });

  const result = await pool.query(
    `SELECT m.*, u.name AS student_name FROM marks m
     JOIN users u ON u.id = m.student_id
     WHERE m.subject_id = $1
     ORDER BY m.created_at DESC`,
    [subjectId]
  );
  res.json(result.rows);
});

module.exports = router;
