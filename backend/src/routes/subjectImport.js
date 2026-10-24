const express = require('express');
const multer = require('multer');
const ExcelJS = require('exceljs');
const pool = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');
const { GRADES, CLASSROOMS } = require('../utils/schoolStructure');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const MAX_ROWS = 500;

// Case/space-insensitive key for matching names typed in Excel
const norm = (v) => String(v ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

// Grade as typed in Excel ("1 mid", "1mid", "1 MID") -> the canonical grade, or the raw text if unknown
function matchGrade(raw) {
  const key = norm(raw).replace(/\s/g, '');
  return GRADES.find((g) => g.toLowerCase().replace(/\s/g, '') === key) || String(raw ?? '').trim();
}

// "A,B,C" / "A B C" / "A-B-C" / "ABC" -> ['A','B','C'] (only valid classrooms; anything else is kept so it can be flagged)
function parseSections(raw) {
  const text = String(raw ?? '').trim().toUpperCase();
  if (!text) return [];
  const parts = text.split(/[\s,;/\-+&،]+/).filter(Boolean);
  const letters = parts.length === 1 && parts[0].length > 1 && [...parts[0]].every((c) => CLASSROOMS.includes(c)) ? [...parts[0]] : parts;
  return [...new Set(letters)].sort();
}

// POST /api/subjects/import
// Reads an .xlsx of teacher assignments and returns it as rows for the browser to show and edit.
// NOTHING is saved here — the admin reviews/edits the rows and saves them through POST /api/subjects/sync.
// Columns: Teacher | Subject | Grade | Classrooms
//   Teacher    = the teacher's name or username
//   Classrooms = one or several, e.g. "A,B,C" (a single classroom per row, one row per classroom, also works)
// A first row that looks like a header is skipped. Rows whose teacher cannot be matched come back with
// teacherId = null: `newTeacher` when no teacher has that name (saving creates the account and a login),
// `teacherAmbiguous` when several teachers share it (the admin must pick one).
router.post('/import', requireAuth, requireRole('admin'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) return res.status(400).json({ error: 'The file has no sheets' });

    const teachers = (await pool.query("SELECT id, name, username FROM users WHERE role = 'teacher'")).rows;
    const byUsername = new Map(teachers.map((t) => [norm(t.username), t]));
    const byName = new Map();
    for (const t of teachers) {
      const k = norm(t.name);
      byName.set(k, byName.has(k) ? null : t); // two teachers with the same name -> ambiguous, must be picked by hand
    }

    const rows = [];
    for (let i = 1; i <= sheet.rowCount; i++) {
      const r = sheet.getRow(i);
      const teacherText = r.getCell(1).text?.trim() || '';
      const name = r.getCell(2).text?.trim() || '';
      const gradeText = r.getCell(3).text?.trim() || '';
      const sectionsText = r.getCell(4).text?.trim() || '';
      if (!teacherText && !name && !gradeText && !sectionsText) continue; // blank row

      if (i === 1 && /^(teacher|teacherusername|المعلم|معلم|اسم المعلم)$/i.test(teacherText.replace(/\s+/g, ' '))) continue; // header

      const byUser = byUsername.get(norm(teacherText));
      const nameHit = byName.get(norm(teacherText)); // undefined = no such name, null = several teachers share it
      const match = byUser || nameHit || null;
      rows.push({
        teacherText,
        teacherId: match ? match.id : null,
        // no teacher of that name yet: saving will create the account and hand out a login
        newTeacher: !match && nameHit === undefined && !!teacherText,
        // two or more teachers have this name: the admin has to say which one
        teacherAmbiguous: !match && nameHit === null,
        name,
        grade: matchGrade(gradeText),
        sections: parseSections(sectionsText)
      });
      if (rows.length > MAX_ROWS) return res.status(400).json({ error: `The file has more than ${MAX_ROWS} rows` });
    }

    // a one-classroom-per-row file: merge rows that are the same teacher + subject + grade
    const merged = new Map();
    for (const row of rows) {
      const key = `${row.teacherId ?? `t:${norm(row.teacherText)}`}|${norm(row.name)}|${row.grade}`;
      if (!merged.has(key)) merged.set(key, { ...row, sections: [...row.sections] });
      else merged.get(key).sections = [...new Set([...merged.get(key).sections, ...row.sections])].sort();
    }

    res.json({ rows: [...merged.values()] });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Could not read the file — upload an .xlsx spreadsheet' });
  }
});

module.exports = router;
