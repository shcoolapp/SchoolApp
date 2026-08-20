const express = require('express');
const pool = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');
const { buildWorkbook } = require('../utils/exportExcel');

const router = express.Router();

// GET /api/archive/my-data — teacher archives only their own subjects' data
router.get('/my-data', requireAuth, requireRole('teacher'), async (req, res) => {
  try {
    const teacherId = req.user.id;

    const subjects = await pool.query('SELECT * FROM subjects WHERE teacher_id = $1', [teacherId]);
    const subjectIds = subjects.rows.map((s) => s.id);

    const marks = subjectIds.length
      ? await pool.query(
          `SELECT m.*, u.name AS student_name FROM marks m
           JOIN users u ON u.id = m.student_id
           WHERE m.subject_id = ANY($1)`,
          [subjectIds]
        )
      : { rows: [] };

    const homework = subjectIds.length
      ? await pool.query('SELECT * FROM homework WHERE subject_id = ANY($1)', [subjectIds])
      : { rows: [] };

    const exams = subjectIds.length
      ? await pool.query('SELECT * FROM exams WHERE subject_id = ANY($1)', [subjectIds])
      : { rows: [] };

    const buffer = await buildWorkbook({
      Subjects: subjects.rows,
      Marks: marks.rows,
      Homework: homework.rows,
      Exams: exams.rows
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="my-archive.xlsx"');
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to build archive' });
  }
});

// GET /api/archive/full-school — full dataset export (used by admin / yearly backup job)
router.get('/full-school', requireAuth, requireRole('teacher'), async (req, res) => {
  try {
    const [users, subjects, enrollments, marks, homework, exams] = await Promise.all([
      pool.query('SELECT id, name, email, role FROM users'),
      pool.query('SELECT * FROM subjects'),
      pool.query('SELECT * FROM enrollments'),
      pool.query('SELECT * FROM marks'),
      pool.query('SELECT * FROM homework'),
      pool.query('SELECT * FROM exams')
    ]);

    const buffer = await buildWorkbook({
      Users: users.rows,
      Subjects: subjects.rows,
      Enrollments: enrollments.rows,
      Marks: marks.rows,
      Homework: homework.rows,
      Exams: exams.rows
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="full-school-archive.xlsx"');
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to build archive' });
  }
});

module.exports = router;
