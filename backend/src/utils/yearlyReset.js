const pool = require('../db/pool');
const { buildWorkbook } = require('./exportExcel');
const { uploadToFallbackDrive } = require('./driveBackup');

// Runs the full-school export, backs it up, then wipes activity data.
// Trigger this via a scheduled job (e.g. node-cron, or an external scheduler
// hitting a protected endpoint) on August 1st each year.
async function runYearlyReset() {
  console.log('[yearlyReset] Starting yearly backup + wipe...');

  const [users, subjects, enrollments, marks, homework, exams, todos] = await Promise.all([
    pool.query('SELECT id, name, email, role, grade, classroom_section FROM users'),
    pool.query('SELECT * FROM subjects'),
    pool.query('SELECT * FROM enrollments'),
    pool.query('SELECT * FROM marks'),
    pool.query('SELECT * FROM homework'),
    pool.query('SELECT * FROM exams'),
    pool.query('SELECT * FROM todos')
  ]);

  const buffer = await buildWorkbook({
    Users: users.rows,
    Subjects: subjects.rows,
    Enrollments: enrollments.rows,
    Marks: marks.rows,
    Homework: homework.rows,
    Exams: exams.rows,
    Todos: todos.rows
  });

  const filename = `school-backup-${new Date().getFullYear()}.xlsx`;

  const uploaded = await uploadToFallbackDrive(buffer, filename);
  console.log(`[yearlyReset] Backup uploaded to Drive: ${filename} (${buffer.length} bytes) -> ${uploaded.webViewLink}`);

  // Wipe activity data for the year, including enrollments — a new school year
  // means the same students move up a grade/classroom, so last year's
  // enrollments would otherwise be stale. Re-importing the new year's roster
  // recreates correct enrollments automatically. Subjects and user accounts
  // (teachers/students) are kept, since those persist across years; only
  // per-year activity resets.
  await pool.query('DELETE FROM homework_answers');
  await pool.query('DELETE FROM homework_submissions');
  await pool.query('DELETE FROM homework_questions');
  await pool.query('DELETE FROM homework');
  await pool.query('DELETE FROM marks');
  await pool.query('DELETE FROM exams');
  await pool.query('DELETE FROM enrollments');
  await pool.query('DELETE FROM todos');

  console.log('[yearlyReset] Wipe complete.');
}

module.exports = { runYearlyReset };
