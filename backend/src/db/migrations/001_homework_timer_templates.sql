-- Migration 001: homework timer + templates + attempts
-- Safe to run more than once. Backward compatible: the old backend keeps working
-- until the new one is deployed, so run this FIRST, then deploy.

-- 1) Timer: minutes allowed once a student opens the homework (NULL = no time limit)
ALTER TABLE homework
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER
  CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 1 AND 600);

-- 2) Templates: 1 to 5 full question sets per homework
CREATE TABLE IF NOT EXISTS homework_templates (
  id SERIAL PRIMARY KEY,
  homework_id INTEGER NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  position SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 5),
  UNIQUE (homework_id, position)
);

ALTER TABLE homework_questions
  ADD COLUMN IF NOT EXISTS template_id INTEGER REFERENCES homework_templates(id) ON DELETE CASCADE;

-- Existing homework becomes "template 1" of itself
INSERT INTO homework_templates (homework_id, position)
SELECT DISTINCT homework_id, 1 FROM homework_questions WHERE template_id IS NULL
ON CONFLICT DO NOTHING;

UPDATE homework_questions q
SET template_id = t.id
FROM homework_templates t
WHERE t.homework_id = q.homework_id AND t.position = 1 AND q.template_id IS NULL;

-- 3) Attempts: attempt_no = 1 is the official one (the only one that counts); 2+ are practice
CREATE TABLE IF NOT EXISTS homework_attempts (
  id SERIAL PRIMARY KEY,
  homework_id INTEGER NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id INTEGER NOT NULL REFERENCES homework_templates(id) ON DELETE CASCADE,
  attempt_no INTEGER NOT NULL CHECK (attempt_no >= 1),
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMP,
  score INTEGER,
  total INTEGER,
  UNIQUE (homework_id, student_id, attempt_no)
);

CREATE TABLE IF NOT EXISTS homework_attempt_answers (
  id SERIAL PRIMARY KEY,
  attempt_id INTEGER NOT NULL REFERENCES homework_attempts(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES homework_questions(id) ON DELETE CASCADE,
  selected_option CHAR(1) NOT NULL CHECK (selected_option IN ('a','b','c','d')),
  is_correct BOOLEAN NOT NULL,
  UNIQUE (attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_hw_templates_homework ON homework_templates(homework_id);
CREATE INDEX IF NOT EXISTS idx_hw_questions_template ON homework_questions(template_id);
CREATE INDEX IF NOT EXISTS idx_hw_attempts_homework ON homework_attempts(homework_id);
CREATE INDEX IF NOT EXISTS idx_hw_attempts_student ON homework_attempts(student_id);

-- NOTE: the old homework_answers table is left untouched (no longer written to).
