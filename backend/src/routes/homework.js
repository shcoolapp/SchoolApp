const express = require('express');
const multer = require('multer');
const pool = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');
const { uploadHomeworkFile, deleteFromDrive } = require('../utils/driveBackup');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB cap

// Seconds of tolerance after the timer hits zero, so a slow network doesn't cost a student their answers.
const GRACE_SECONDS = 15;
const MAX_TEMPLATES = 5;

// Deadline (as SQL) of an attempt: started_at + time limit when the homework has one;
// otherwise the due date for the official attempt, and no deadline for practice attempts.
const ATTEMPT_DEADLINE_SQL = `
  CASE
    WHEN h.duration_minutes IS NOT NULL THEN a.started_at + (h.duration_minutes * INTERVAL '1 minute')
    WHEN a.attempt_no = 1 THEN h.due_date
    ELSE NULL
  END`;

// Closes attempts whose time ran out without a submission: score 0, nothing counted.
// Called before anything reads attempt state, so results are never stale.
async function expireOverdueAttempts(db, { homeworkId = null, subjectId = null } = {}) {
  await db.query(
    `UPDATE homework_attempts a
     SET submitted_at = (${ATTEMPT_DEADLINE_SQL}),
         score = 0,
         total = (SELECT COUNT(*) FROM homework_questions q WHERE q.template_id = a.template_id)
     FROM homework h
     WHERE a.homework_id = h.id
       AND a.submitted_at IS NULL
       AND ($1::int IS NULL OR h.id = $1)
       AND ($2::int IS NULL OR h.subject_id = $2)
       AND (${ATTEMPT_DEADLINE_SQL}) + ($3 * INTERVAL '1 second') < NOW()`,
    [homeworkId, subjectId, GRACE_SECONDS]
  );
}

// Student must be enrolled in the homework's subject. Returns the homework row or null.
async function getHomeworkForStudent(homeworkId, studentId) {
  const result = await pool.query(
    `SELECT h.* FROM homework h
     JOIN enrollments e ON e.subject_id = h.subject_id AND e.student_id = $2
     WHERE h.id = $1`,
    [homeworkId, studentId]
  );
  return result.rows[0] || null;
}

// Questions of a template, without the correct answers.
async function getTemplateQuestions(templateId) {
  const result = await pool.query(
    `SELECT id, question_text, option_a, option_b, option_c, option_d, order_index
     FROM homework_questions WHERE template_id = $1 ORDER BY order_index`,
    [templateId]
  );
  return result.rows;
}

// Shape of the response when a student starts or resumes an attempt.
// remainingSeconds is computed by the database clock, so it never depends on the student's own clock.
async function buildAttemptResponse(attempt) {
  const info = await pool.query(
    `SELECT t.position AS template_number, h.duration_minutes,
            EXTRACT(EPOCH FROM ((${ATTEMPT_DEADLINE_SQL}) - NOW())) AS remaining_seconds
     FROM homework_attempts a
     JOIN homework h ON h.id = a.homework_id
     JOIN homework_templates t ON t.id = a.template_id
     WHERE a.id = $1`,
    [attempt.id]
  );
  const row = info.rows[0];
  const questions = await getTemplateQuestions(attempt.template_id);
  return {
    attemptId: attempt.id,
    isOfficial: attempt.attempt_no === 1,
    templateNumber: row.template_number,
    durationMinutes: row.duration_minutes,
    remainingSeconds: row.remaining_seconds === null ? null : Math.max(0, Math.floor(Number(row.remaining_seconds))),
    questions
  };
}

// POST /api/homework — teacher creates MCQ homework with 1 to 5 templates
// body: { subjectId, title, description, dueDate, durationMinutes?,
//         templates: [ { questions: [{questionText, optionA..D, correctOption}] }, ... ] }
// (a plain `questions` array is still accepted and becomes a single template)
router.post('/', requireAuth, requireRole('teacher'), async (req, res) => {
  const { subjectId, title, description, dueDate, durationMinutes } = req.body;
  const templates = req.body.templates || (req.body.questions ? [{ questions: req.body.questions }] : []);

  if (!Array.isArray(templates) || templates.length < 1 || templates.length > MAX_TEMPLATES) {
    return res.status(400).json({ error: `Homework needs between 1 and ${MAX_TEMPLATES} templates` });
  }
  if (templates.some((tpl) => !Array.isArray(tpl.questions) || tpl.questions.length === 0)) {
    return res.status(400).json({ error: 'Every template needs at least one question' });
  }

  let duration = null;
  if (durationMinutes !== undefined && durationMinutes !== null && durationMinutes !== '') {
    duration = Number(durationMinutes);
    if (!Number.isInteger(duration) || duration < 1 || duration > 600) {
      return res.status(400).json({ error: 'Time limit must be a whole number of minutes between 1 and 600' });
    }
  }

  const subject = await pool.query('SELECT * FROM subjects WHERE id = $1 AND teacher_id = $2', [subjectId, req.user.id]);
  if (subject.rows.length === 0) return res.status(404).json({ error: 'Subject not found or not yours' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const hwResult = await client.query(
      'INSERT INTO homework (subject_id, title, description, type, due_date, duration_minutes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [subjectId, title, description, 'mcq', dueDate, duration]
    );
    const homework = hwResult.rows[0];

    for (let t = 0; t < templates.length; t++) {
      const tplResult = await client.query(
        'INSERT INTO homework_templates (homework_id, position) VALUES ($1, $2) RETURNING id',
        [homework.id, t + 1]
      );
      const templateId = tplResult.rows[0].id;
      const questions = templates[t].questions;

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await client.query(
          `INSERT INTO homework_questions
           (homework_id, template_id, question_text, option_a, option_b, option_c, option_d, correct_option, order_index)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [homework.id, templateId, q.questionText, q.optionA, q.optionB, q.optionC, q.optionD, q.correctOption, i]
        );
      }
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

// POST /api/homework/:id/start — student opens an MCQ homework. The timer starts here.
// body (optional): { practiceTemplate: <1-5> }  — only used for practice attempts.
//
//  - Open attempt not yet expired      -> resumes it (same template, same deadline, nothing restarts)
//  - First time ever                   -> official attempt on a randomly chosen template (only before due date)
//  - Official attempt already finished -> practice attempt (random template, or the one asked for)
router.post('/:id/start', requireAuth, requireRole('student'), async (req, res) => {
  const homeworkId = Number(req.params.id);
  const studentId = req.user.id;

  try {
    const hw = await getHomeworkForStudent(homeworkId, studentId);
    if (!hw || hw.type !== 'mcq') return res.status(404).json({ error: 'Homework not found' });

    await expireOverdueAttempts(pool, { homeworkId });

    // Resume an attempt that is still open
    const open = await pool.query(
      'SELECT * FROM homework_attempts WHERE homework_id = $1 AND student_id = $2 AND submitted_at IS NULL ORDER BY attempt_no DESC LIMIT 1',
      [homeworkId, studentId]
    );
    if (open.rows.length > 0) return res.json(await buildAttemptResponse(open.rows[0]));

    const last = await pool.query(
      'SELECT MAX(attempt_no) AS max_no FROM homework_attempts WHERE homework_id = $1 AND student_id = $2',
      [homeworkId, studentId]
    );
    const lastNo = last.rows[0].max_no;
    const isOfficial = lastNo === null;

    if (isOfficial && new Date() > new Date(hw.due_date)) {
      return res.status(400).json({ error: 'Due date has passed' });
    }

    // Pick the template: random for the official attempt; random or chosen for practice
    const templates = await pool.query(
      `SELECT t.id, t.position FROM homework_templates t
       WHERE t.homework_id = $1 AND EXISTS (SELECT 1 FROM homework_questions q WHERE q.template_id = t.id)
       ORDER BY t.position`,
      [homeworkId]
    );
    if (templates.rows.length === 0) return res.status(400).json({ error: 'This homework has no questions' });

    let chosen;
    const wanted = Number(req.body?.practiceTemplate);
    if (!isOfficial && wanted) {
      chosen = templates.rows.find((tpl) => tpl.position === wanted);
      if (!chosen) return res.status(400).json({ error: 'Template not found' });
    } else {
      chosen = templates.rows[Math.floor(Math.random() * templates.rows.length)];
    }

    try {
      const inserted = await pool.query(
        `INSERT INTO homework_attempts (homework_id, student_id, template_id, attempt_no)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [homeworkId, studentId, chosen.id, isOfficial ? 1 : lastNo + 1]
      );
      return res.status(201).json(await buildAttemptResponse(inserted.rows[0]));
    } catch (err) {
      // Two start requests at once (double click): the unique key lets only one win; resume that one.
      if (err.code === '23505') {
        const again = await pool.query(
          'SELECT * FROM homework_attempts WHERE homework_id = $1 AND student_id = $2 AND submitted_at IS NULL ORDER BY attempt_no DESC LIMIT 1',
          [homeworkId, studentId]
        );
        if (again.rows.length > 0) return res.json(await buildAttemptResponse(again.rows[0]));
      }
      throw err;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to start homework' });
  }
});

// POST /api/homework/:id/submit — student submits an attempt, auto-graded on the server
// body: { attemptId, answers: [{questionId, selectedOption}] }
router.post('/:id/submit', requireAuth, requireRole('student'), async (req, res) => {
  const homeworkId = Number(req.params.id);
  const studentId = req.user.id;
  const { attemptId, answers } = req.body;

  try {
    const hw = await getHomeworkForStudent(homeworkId, studentId);
    if (!hw || hw.type !== 'mcq') return res.status(404).json({ error: 'Homework not found' });

    await expireOverdueAttempts(pool, { homeworkId });

    const attemptResult = await pool.query(
      'SELECT * FROM homework_attempts WHERE id = $1 AND homework_id = $2 AND student_id = $3',
      [attemptId, homeworkId, studentId]
    );
    const attempt = attemptResult.rows[0];
    if (!attempt) return res.status(404).json({ error: 'Attempt not found' });

    // Closed already: either submitted before, or the time ran out (expireOverdueAttempts closed it with score 0
    // at exactly its deadline).
    if (attempt.submitted_at !== null) {
      const check = await pool.query(
        `SELECT (a.submitted_at = (${ATTEMPT_DEADLINE_SQL})) AS timed_out
         FROM homework_attempts a JOIN homework h ON h.id = a.homework_id WHERE a.id = $1`,
        [attempt.id]
      );
      return res.status(400).json({
        error: check.rows[0].timed_out ? 'Time is over for this attempt' : 'This attempt was already submitted',
        score: attempt.score,
        total: attempt.total
      });
    }

    const questions = await pool.query(
      'SELECT id, correct_option FROM homework_questions WHERE template_id = $1',
      [attempt.template_id]
    );
    const correctMap = Object.fromEntries(questions.rows.map((q) => [q.id, q.correct_option]));

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let correctCount = 0;
      const seen = new Set();

      for (const ans of Array.isArray(answers) ? answers : []) {
        const qid = Number(ans.questionId);
        // Only questions of this attempt's template, each counted once
        if (!(qid in correctMap) || seen.has(qid) || !['a', 'b', 'c', 'd'].includes(ans.selectedOption)) continue;
        seen.add(qid);

        const isCorrect = correctMap[qid] === ans.selectedOption;
        if (isCorrect) correctCount++;
        await client.query(
          `INSERT INTO homework_attempt_answers (attempt_id, question_id, selected_option, is_correct)
           VALUES ($1, $2, $3, $4)`,
          [attempt.id, qid, ans.selectedOption, isCorrect]
        );
      }

      // Guard against a concurrent double submit: only the first UPDATE sees submitted_at IS NULL
      const closed = await client.query(
        'UPDATE homework_attempts SET submitted_at = NOW(), score = $2, total = $3 WHERE id = $1 AND submitted_at IS NULL RETURNING id',
        [attempt.id, correctCount, questions.rows.length]
      );
      if (closed.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'This attempt was already submitted' });
      }

      await client.query('COMMIT');
      res.json({ score: correctCount, total: questions.rows.length, isOfficial: attempt.attempt_no === 1 });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit answers' });
  }
});

// GET /api/homework/:id/results — teacher sees every enrolled student's OFFICIAL (first attempt) result
router.get('/:id/results', requireAuth, requireRole('teacher'), async (req, res) => {
  const homeworkId = Number(req.params.id);

  const hw = await pool.query(
    `SELECT h.* FROM homework h JOIN subjects s ON s.id = h.subject_id
     WHERE h.id = $1 AND s.teacher_id = $2 AND h.type = 'mcq'`,
    [homeworkId, req.user.id]
  );
  if (hw.rows.length === 0) return res.status(404).json({ error: 'Homework not found or not yours' });

  await expireOverdueAttempts(pool, { homeworkId });

  const result = await pool.query(
    `SELECT u.id AS student_id, u.name AS student_name,
            a.score, a.total, a.started_at, a.submitted_at, t.position AS template_number,
            (SELECT COUNT(*) FROM homework_attempts p
              WHERE p.homework_id = $1 AND p.student_id = u.id AND p.attempt_no > 1) AS practice_attempts
     FROM enrollments e
     JOIN users u ON u.id = e.student_id
     LEFT JOIN homework_attempts a ON a.homework_id = $1 AND a.student_id = u.id AND a.attempt_no = 1
     LEFT JOIN homework_templates t ON t.id = a.template_id
     WHERE e.subject_id = $2
     ORDER BY u.name`,
    [homeworkId, hw.rows[0].subject_id]
  );
  res.json(result.rows);
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

// GET /api/homework/subject/:id — list homework for a subject (teacher who owns it, or enrolled student)
router.get('/subject/:id', requireAuth, async (req, res) => {
  const subjectId = req.params.id;

  if (req.user.role === 'teacher') {
    const owns = await pool.query('SELECT id FROM subjects WHERE id = $1 AND teacher_id = $2', [subjectId, req.user.id]);
    if (owns.rows.length === 0) return res.status(403).json({ error: 'Not your subject' });
  } else {
    const enrolled = await pool.query('SELECT id FROM enrollments WHERE subject_id = $1 AND student_id = $2', [subjectId, req.user.id]);
    if (enrolled.rows.length === 0) return res.status(403).json({ error: 'Not enrolled in this subject' });
  }

  await expireOverdueAttempts(pool, { subjectId: Number(subjectId) });

  // For a student, oa = their own official (first) attempt, so the UI can show start / resume / score.
  const result = await pool.query(
    `SELECT h.*,
            (SELECT COUNT(*) FROM homework_templates t WHERE t.homework_id = h.id) AS template_count,
            oa.score AS my_score, oa.total AS my_total,
            oa.started_at AS my_started_at, oa.submitted_at AS my_submitted_at
     FROM homework h
     LEFT JOIN homework_attempts oa ON oa.homework_id = h.id AND oa.student_id = $2 AND oa.attempt_no = 1
     WHERE h.subject_id = $1
     ORDER BY h.due_date`,
    [subjectId, req.user.id]
  );
  res.json(result.rows);
});

module.exports = router;
module.exports.cleanupExpiredHomeworkFiles = cleanupExpiredHomeworkFiles;
