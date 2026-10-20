const express = require('express');
const { google } = require('googleapis');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Google's public holiday calendar for Iraq. The "en." prefix is display
// language only — this covers Iraq regardless of language.
const IRAQ_HOLIDAY_CALENDAR_ID = 'en.iq#holiday@group.v.calendar.google.com';

// Simple in-memory cache keyed by year — holidays don't change during a session,
// so no need to hit the API on every calendar load.
const cache = {};
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function getCalendarClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n')
    },
    scopes: ['https://www.googleapis.com/auth/calendar.readonly']
  });
  return google.calendar({ version: 'v3', auth });
}

// GET /api/holidays/:year — returns Iraq public holidays for that year
router.get('/:year', requireAuth, async (req, res) => {
  const { year } = req.params;
  if (!/^\d{4}$/.test(year)) {
    return res.status(400).json({ error: 'Invalid year' });
  }

  const cached = cache[year];
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return res.json(cached.data);
  }

  try {
    const calendar = getCalendarClient();
    const response = await calendar.events.list({
      calendarId: IRAQ_HOLIDAY_CALENDAR_ID,
      timeMin: `${year}-01-01T00:00:00Z`,
      timeMax: `${year}-12-31T23:59:59Z`,
      singleEvents: true,
      orderBy: 'startTime'
    });

    const holidays = (response.data.items || []).map((event) => ({
      date: event.start.date || event.start.dateTime,
      name: event.summary
    }));

    cache[year] = { data: holidays, fetchedAt: Date.now() };
    res.json(holidays);
  } catch (err) {
    console.error('Failed to fetch holidays:', err.message);
    // Fall back to stale cache if available, otherwise empty list (calendar still works, just no holiday shading)
    if (cached) return res.json(cached.data);
    res.json([]);
  }
});

module.exports = router;
