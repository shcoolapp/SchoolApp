const pool = require('../db/pool');
const { buildWorkbook } = require('./exportExcel');
const { uploadToFallbackDrive } = require('./driveBackup');

// Runs the full-school export, backs it up, then wipes the year's data.
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

  // Students are treated as brand-new to the school each year — there is no
  // permanent student identity carried forward. Deleting the student accounts
  // outright (not just their activity data) means next year's bulk import
  // creates entirely fresh accounts with fresh ids, with nothing left over
  // from the previous year. Marks/homework answers/enrollments/todos tied to
  // those students cascade-delete automatically via foreign keys.
  //
  // Teacher and admin accounts persist across years, since those aren't
  // re-enrolled annually the way students are.
  await pool.query('DELETE FROM homework_questions');
  await pool.query('DELETE FROM homework');
  await pool.query('DELETE FROM exams');
  await pool.query('DELETE FROM todos');
  await pool.query("DELETE FROM users WHERE role = 'student'");

  console.log(`[yearlyReset] Wipe complete. Removed ${users.rows.filter((u) => u.role === 'student').length} student accounts.`);
}

module.exports = { runYearlyReset };
