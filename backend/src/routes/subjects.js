const express = require('express');
const pool = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// POST /api/subjects — teacher creates a subject for one grade+classroom
router.post('/', requireAuth, requireRole('teacher'), async (req, res) => {
  const { name, grade, classroomSection } = req.body;
  if (!name || !grade || !classroomSection) {
    return res.status(400).json({ error: 'Subject name, grade, and classroom section are required' });
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

// GET /api/subjects — teacher sees their own subjects, student sees enrolled subjects
router.get('/', requireAuth, async (req, res) => {
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

// POST /api/subjects/:id/enroll — teacher enrolls a student into their subject
router.post('/:id/enroll', requireAuth, requireRole('teacher'), async (req, res) => {
  const { studentId } = req.body;
  const subjectId = req.params.id;

  const subject = await pool.query('SELECT * FROM subjects WHERE id = $1 AND teacher_id = $2', [subjectId, req.user.id]);
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

module.exports = router;
