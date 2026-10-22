const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { publicKey } = require('../utils/push');

const router = express.Router();

// GET /api/push/public-key — 404 when the server has no VAPID keys (push switched off)
router.get('/public-key', requireAuth, (req, res) => {
  if (!publicKey) return res.status(404).json({ error: 'Push notifications are not configured' });
  res.json({ publicKey });
});

// POST /api/push/subscribe — body: a PushSubscription JSON { endpoint, keys: { p256dh, auth } }
router.post('/subscribe', requireAuth, async (req, res) => {
  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) return res.status(400).json({ error: 'Invalid subscription' });
  // the same device can be used by another account later: the endpoint always belongs to the latest user
  await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
    [req.user.id, endpoint, keys.p256dh, keys.auth]
  );
  res.status(201).json({ ok: true });
});

// POST /api/push/unsubscribe — body: { endpoint }
router.post('/unsubscribe', requireAuth, async (req, res) => {
  const { endpoint } = req.body || {};
  if (endpoint) await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2', [endpoint, req.user.id]);
  res.json({ ok: true });
});

module.exports = router;
