const express = require('express');
const multer = require('multer');
const ExcelJS = require('exceljs');
const pool = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');
const { isValidGrade, isValidClassroom, GRADES, CLASSROOMS } = require('../utils/schoolStructure');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/subjects/import
// Bulk-assigns subjects to teachers in one go, instead of each teacher manually
// creating subjects one at a time. Expects an .xlsx with columns:
//   teacherUsername | subjectName | grade | classroomSection
//
// teacherUsername must match an existing teacher's username exactly (use the
// credentials sheet from /api/users/import or /api/users/credentials to find it).
// Any row referencing a teacher that doesn't exist, or an invalid grade/classroom,
// is skipped and reported in errors — nothing partial gets created for that row.
router.post('/import', requireAuth, requireRole('admin'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const sheet = workbook.worksheets[0];

    const results = { created: 0, skipped: 0, enrolled: 0, errors: [] };

    for (let i = 2; i <= sheet.rowCount; i++) { // row 1 = headers
      const row = sheet.getRow(i);
      const teacherUsername = row.getCell(1).text?.trim();
      const subjectName = row.getCell(2).text?.trim();
      const grade = row.getCell(3).text?.trim();
      const classroomSection = row.getCell(4).text?.trim();

      if (!teacherUsername || !subjectName) continue; // skip blank rows

      if (!isValidGrade(grade)) {
        results.errors.push(`Row ${i}: invalid grade "${grade}" — must be one of: ${GRADES.join(', ')}`);
        continue;
      }
      if (!isValidClassroom(classroomSection)) {
        results.errors.push(`Row ${i}: invalid classroom "${classroomSection}" — must be one of: ${CLASSROOMS.join(', ')}`);
        continue;
      }

      const teacher = await pool.query(
        "SELECT id FROM users WHERE username = $1 AND role = 'teacher'",
        [teacherUsername]
      );
      if (teacher.rows.length === 0) {
        results.errors.push(`Row ${i}: no teacher found with username "${teacherUsername}"`);
        continue;
      }
      const teacherId = teacher.rows[0].id;

      const existing = await pool.query(
        'SELECT id FROM subjects WHERE name = $1 AND grade = $2 AND classroom_section = $3 AND teacher_id = $4',
        [subjectName, grade, classroomSection, teacherId]
      );
      if (existing.rows.length > 0) {
        results.skipped++;
        continue;
      }

      const inserted = await pool.query(
        'INSERT INTO subjects (name, grade, classroom_section, teacher_id) VALUES ($1, $2, $3, $4) RETURNING id',
        [subjectName, grade, classroomSection, teacherId]
      );
      results.created++;

      // Retroactively enroll any students already in this grade+classroom.
      const matchingStudents = await pool.query(
        "SELECT id FROM users WHERE role = 'student' AND grade = $1 AND classroom_section = $2",
        [grade, classroomSection]
      );
      for (const student of matchingStudents.rows) {
        await pool.query(
          'INSERT INTO enrollments (student_id, subject_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [student.id, inserted.rows[0].id]
        );
        results.enrolled++;
      }
    }

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process file' });
  }
});

module.exports = router;
