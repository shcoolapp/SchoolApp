const express = require('express');
const multer = require('multer');
const pool = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');
const { uploadHomeworkFile, deleteFromDrive } = require('../utils/driveBackup');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB cap

// POST /api/homework — teacher creates MCQ homework with questions
// body: { subjectId, title, description, dueDate, questions: [{questionText, optionA..D, correctOption}] }
router.post('/', requireAuth, requireRole('teacher'), async (req, res) => {
  const { subjectId, title, description, dueDate, questions } = req.body;

  const subject = await pool.query('SELECT * FROM subjects WHERE id = $1 AND teacher_id = $2', [subjectId, req.user.id]);
  if (subject.rows.length === 0) return res.status(404).json({ error: 'Subject not found or not yours' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const hwResult = await client.query(
      'INSERT INTO homework (subject_id, title, description, type, due_date) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [subjectId, title, description, 'mcq', dueDate]
    );
    const homework = hwResult.rows[0];

    for (let i = 0; i < (questions || []).length; i++) {
      const q = questions[i];
      await client.query(
        `INSERT INTO homework_questions
         (homework_id, question_text, option_a, option_b, option_c, option_d, correct_option, order_index)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [homework.id, q.questionText, q.optionA, q.optionB, q.optionC, q.optionD, q.correctOption, i]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(homework);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to create homework' });
  } finally {
    client.release();
  }
});

// GET /api/homework/:id/questions — student fetches questions for a homework set (no correct_option leaked)
router.get('/:id/questions', requireAuth, requireRole('student'), async (req, res) => {
  const result = await pool.query(
    'SELECT id, question_text, option_a, option_b, option_c, option_d, order_index FROM homework_questions WHERE homework_id = $1 ORDER BY order_index',
    [req.params.id]
  );
  res.json(result.rows);
});

// POST /api/homework/:id/submit — student submits answers, auto-graded
// body: { answers: [{questionId, selectedOption}] }
router.post('/:id/submit', requireAuth, requireRole('student'), async (req, res) => {
  const homeworkId = req.params.id;
  const { answers } = req.body;
  const studentId = req.user.id;

  const hw = await pool.query('SELECT * FROM homework WHERE id = $1', [homeworkId]);
  if (hw.rows.length === 0) return res.status(404).json({ error: 'Homework not found' });
  if (new Date() > new Date(hw.rows[0].due_date)) {
    return res.status(400).json({ error: 'Due date has passed' });
  }

  const questions = await pool.query('SELECT id, correct_option FROM homework_questions WHERE homework_id = $1', [homeworkId]);
  const correctMap = Object.fromEntries(questions.rows.map((q) => [q.id, q.correct_option]));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let correctCount = 0;

    for (const ans of answers) {
      const isCorrect = correctMap[ans.questionId] === ans.selectedOption;
      if (isCorrect) correctCount++;

      await client.query(
        `INSERT INTO homework_answers (question_id, student_id, selected_option, is_correct)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (question_id, student_id) DO UPDATE SET selected_option = $3, is_correct = $4`,
        [ans.questionId, studentId, ans.selectedOption, isCorrect]
      );
    }

    await client.query('COMMIT');
    res.json({ score: correctCount, total: questions.rows.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to submit answers' });
  } finally {
    client.release();
  }
});

// POST /api/homework/file — teacher creates file-based (non-MCQ) homework
router.post('/file', requireAuth, requireRole('teacher'), async (req, res) => {
  const { subjectId, title, description, dueDate } = req.body;

  const subject = await pool.query('SELECT * FROM subjects WHERE id = $1 AND teacher_id = $2', [subjectId, req.user.id]);
  if (subject.rows.length === 0) return res.status(404).json({ error: 'Subject not found or not yours' });

  const result = await pool.query(
    'INSERT INTO homework (subject_id, title, description, type, due_date) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [subjectId, title, description, 'file', dueDate]
  );
  res.status(201).json(result.rows[0]);
});

// POST /api/homework/:id/submit-file — student uploads a file for file-based homework
router.post('/:id/submit-file', requireAuth, requireRole('student'), upload.single('file'), async (req, res) => {
  const homeworkId = req.params.id;
  const studentId = req.user.id;

  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const hw = await pool.query('SELECT * FROM homework WHERE id = $1 AND type = $2', [homeworkId, 'file']);
  if (hw.rows.length === 0) return res.status(404).json({ error: 'Homework not found' });
  if (new Date() > new Date(hw.rows[0].due_date)) {
    return res.status(400).json({ error: 'Due date has passed' });
  }

  try {
    const filename = `hw${homeworkId}_student${studentId}_${req.file.originalname}`;
    const uploaded = await uploadHomeworkFile(req.file.buffer, filename, req.file.mimetype);

    const result = await pool.query(
      `INSERT INTO homework_submissions (homework_id, student_id, drive_file_id, drive_file_link)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (homework_id, student_id) DO UPDATE SET drive_file_id = $3, drive_file_link = $4, submitted_at = NOW()
       RETURNING *`,
      [homeworkId, studentId, uploaded.id, uploaded.webViewLink]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// GET /api/homework/:id/submissions — teacher views/downloads submissions for their homework
router.get('/:id/submissions', requireAuth, requireRole('teacher'), async (req, res) => {
  const result = await pool.query(
    `SELECT hs.*, u.name AS student_name FROM homework_submissions hs
     JOIN users u ON u.id = hs.student_id
     WHERE hs.homework_id = $1`,
    [req.params.id]
  );
  res.json(result.rows);
});

// Cleanup job: deletes Drive files for homework past due_date + graceDays, called on a schedule.
async function cleanupExpiredHomeworkFiles(graceDays = 14) {
  const expired = await pool.query(
    `SELECT hs.id, hs.drive_file_id FROM homework_submissions hs
     JOIN homework h ON h.id = hs.homework_id
     WHERE h.due_date < NOW() - ($1 || ' days')::interval`,
    [graceDays]
  );

  for (const row of expired.rows) {
    try {
      await deleteFromDrive(row.drive_file_id);
      await pool.query('DELETE FROM homework_submissions WHERE id = $1', [row.id]);
    } catch (err) {
      console.error(`Failed to clean up submission ${row.id}:`, err.message);
    }
  }
  return expired.rows.length;
}

// GET /api/homework/subject/:id — list homework for a subject (both roles)
router.get('/subject/:id', requireAuth, async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM homework WHERE subject_id = $1 ORDER BY due_date',
    [req.params.id]
  );
  res.json(result.rows);
});

module.exports = router;
module.exports.cleanupExpiredHomeworkFiles = cleanupExpiredHomeworkFiles;
