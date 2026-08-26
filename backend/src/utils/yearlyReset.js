const pool = require('../db/pool');
const { buildWorkbook } = require('./exportExcel');
const { uploadToFallbackDrive } = require('./driveBackup');

// Runs the full-school export, backs it up, then wipes activity data.
// Trigger this via a scheduled job (e.g. node-cron, or an external scheduler
// hitting a protected endpoint) on August 1st each year.
async function runYearlyReset() {
  console.log('[yearlyReset] Starting yearly backup + wipe...');

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

  const filename = `school-backup-${new Date().getFullYear()}.xlsx`;

  const uploaded = await uploadToFallbackDrive(buffer, filename);
  console.log(`[yearlyReset] Backup uploaded to Drive: ${filename} (${buffer.length} bytes) -> ${uploaded.webViewLink}`);

  // Wipe activity data. Structural tables (users, subjects) are kept —
  // enrollments wipe is left as an open decision (see note below).
  await pool.query('DELETE FROM homework_answers');
  await pool.query('DELETE FROM homework_submissions');
  await pool.query('DELETE FROM homework_questions');
  await pool.query('DELETE FROM homework');
  await pool.query('DELETE FROM marks');
  await pool.query('DELETE FROM exams');
  // await pool.query('DELETE FROM enrollments'); // uncomment if rosters should reset yearly too

  console.log('[yearlyReset] Wipe complete.');
}

module.exports = { runYearlyReset };
