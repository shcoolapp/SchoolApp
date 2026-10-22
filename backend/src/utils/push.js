const webpush = require('web-push');
const pool = require('../db/pool');

// Web Push needs a VAPID key pair (generate once: npx web-push generate-vapid-keys).
// Without the env vars push is simply switched off and everything else keeps working.
const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
const enabled = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
if (enabled) {
  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:admin@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// Sends one push to every device of the given users. Never throws.
async function pushToUsers(userIds, payload) {
  if (!enabled || !userIds.length) return;
  try {
    const { rows } = await pool.query(
      'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ANY($1::int[])',
      [userIds]
    );
    const message = JSON.stringify(payload);
    await Promise.all(rows.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          message,
          { TTL: 60 * 60 * 24 }
        );
      } catch (err) {
        // 404/410 = the device unsubscribed or the browser data was cleared: forget it
        if (err.statusCode === 404 || err.statusCode === 410) {
          await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]).catch(() => {});
        } else {
          console.error('push failed:', err.statusCode || err.message);
        }
      }
    }));
  } catch (err) {
    console.error('push failed:', err.message);
  }
}

module.exports = { pushToUsers, publicKey: enabled ? VAPID_PUBLIC_KEY : null };
