const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications — latest 50 for the signed-in user + unread count
router.get('/', requireAuth, async (req, res) => {
  const list = await pool.query(
    'SELECT id, type, title, body, ref_id, created_at, read_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 50',
    [req.user.id]
  );
  const unread = await pool.query(
    'SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL',
    [req.user.id]
  );
  res.json({ unread: unread.rows[0].n, items: list.rows });
});

// POST /api/notifications/read-all
router.post('/read-all', requireAuth, async (req, res) => {
  await pool.query('UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL', [req.user.id]);
  res.json({ ok: true });
});

// POST /api/notifications/:id/read
router.post('/:id/read', requireAuth, async (req, res) => {
  await pool.query('UPDATE notifications SET read_at = NOW() WHERE id = $1 AND user_id = $2 AND read_at IS NULL', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

module.exports = router;
