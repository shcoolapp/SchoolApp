const express = require('express');
const pool = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');
const { GRADES, CLASSROOMS, isValidGrade, isValidClassroom } = require('../utils/schoolStructure');

const router = express.Router();

// GET /api/subjects/structure — returns the canonical grade/classroom lists,
// so the frontend can render dropdowns instead of free-text fields.
router.get('/structure', requireAuth, (req, res) => {
  res.json({ grades: GRADES, classrooms: CLASSROOMS });
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
