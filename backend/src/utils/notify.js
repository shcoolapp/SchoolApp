const pool = require('../db/pool');
const { pushToUsers } = require('./push');

// Notifications are a convenience: a failure here must never break the request that triggered it.
async function safe(fn) {
  try { await fn(); } catch (err) { console.error('notify failed:', err.message); }
}

// Stores the in-app notification for each recipient, then pushes it to their devices right away.
async function insertFor(studentIdsQuery, params, { type, title, body, refId }) {
  const { rows } = await pool.query(
    `INSERT INTO notifications (user_id, type, title, body, ref_id)
     SELECT sid, $1::varchar, $2::varchar, $3::text, $4::int FROM (${studentIdsQuery}) AS q(sid)
     RETURNING user_id`,
    [type, title, body || null, refId || null, ...params]
  );
  // not awaited: the teacher's request must not wait for the push services
  pushToUsers(rows.map((r) => r.user_id), { title, body: body || '', type, tag: `${type}-${refId || Date.now()}`, url: '/dashboard' });
}

// Everyone enrolled in a subject
function notifySubjectStudents(subjectId, n) {
  return safe(() => insertFor('SELECT student_id FROM enrollments WHERE subject_id = $5', [subjectId], n));
}

// One student
function notifyUser(userId, n) {
  return safe(() => insertFor('SELECT $5::int', [userId], n));
}

// Students of a grade (and optionally one section); both null = every student
function notifyAudience(grade, section, n) {
  return safe(() => insertFor(
    `SELECT id FROM users WHERE role = 'student'
       AND ($5::text IS NULL OR grade = $5) AND ($6::text IS NULL OR classroom_section = $6)`,
    [grade || null, section || null], n
  ));
}

module.exports = { notifySubjectStudents, notifyUser, notifyAudience };
