const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');
const pool = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/users/import
// Expects an .xlsx file with columns: name | email | role | password
// Only teachers (admins) can bulk-import users.
router.post('/import', requireAuth, requireRole('teacher'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const sheet = workbook.worksheets[0];

    const results = { created: 0, skipped: 0, errors: [] };

    for (let i = 2; i <= sheet.rowCount; i++) { // row 1 = headers
      const row = sheet.getRow(i);
      const name = row.getCell(1).text?.trim();
      const email = row.getCell(2).text?.trim();
      const role = row.getCell(3).text?.trim().toLowerCase();
      const password = row.getCell(4).text?.trim();

      if (!name || !email || !role || !password) continue; // skip blank rows

      if (!['teacher', 'student'].includes(role)) {
        results.errors.push(`Row ${i}: invalid role "${role}"`);
        continue;
      }

      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        results.skipped++;
        continue;
      }

      const passwordHash = await bcrypt.hash(password, 10);
      await pool.query(
        'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
        [name, email, passwordHash, role]
      );
      results.created++;
    }

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process file' });
  }
});

module.exports = router;
