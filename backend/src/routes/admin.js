const express = require('express');
const { runYearlyReset } = require('../utils/yearlyReset');
const { cleanupExpiredHomeworkFiles } = require('./homework');

const router = express.Router();

// These endpoints are triggered by an external scheduler (GitHub Actions cron),
// not by a logged-in user — so they're protected by a shared secret instead of
// the normal JWT auth, passed as a header.
function requireCronSecret(req, res, next) {
  const provided = req.headers['x-cron-secret'];
  if (!provided || provided !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Invalid or missing cron secret' });
  }
  next();
}

// POST /api/admin/run-yearly-reset — backs up full school data to Drive, then
// wipes the year's activity data (marks, homework, exams, enrollments, todos).
// Scheduled to run once a year, Aug 1.
router.post('/run-yearly-reset', requireCronSecret, async (req, res) => {
  try {
    await runYearlyReset();
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('[admin] Yearly reset failed:', err);
    res.status(500).json({ error: 'Yearly reset failed', detail: err.message });
  }
});

// POST /api/admin/run-homework-cleanup — deletes Drive files for file-based
// homework submissions past their due date + grace period. Scheduled to run
// daily (or weekly — grace period makes exact timing non-critical).
router.post('/run-homework-cleanup', requireCronSecret, async (req, res) => {
  try {
    const count = await cleanupExpiredHomeworkFiles(14);
    res.json({ status: 'ok', cleaned: count });
  } catch (err) {
    console.error('[admin] Homework cleanup failed:', err);
    res.status(500).json({ error: 'Homework cleanup failed', detail: err.message });
  }
});

module.exports = router;
