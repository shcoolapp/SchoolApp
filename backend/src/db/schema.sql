-- School Portal Database Schema
-- Postgres (Supabase/Neon)

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  username VARCHAR(150) UNIQUE NOT NULL,
  email VARCHAR(150) UNIQUE,
  password_hash TEXT NOT NULL,
  plaintext_password TEXT, -- stored only for students, so teachers can re-download credentials anytime
  role VARCHAR(10) NOT NULL CHECK (role IN ('teacher', 'student', 'admin')),
  grade VARCHAR(50),
  classroom_section VARCHAR(10),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subjects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  grade VARCHAR(50) NOT NULL,
  classroom_section VARCHAR(10) NOT NULL,
  teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (name, grade, classroom_section, teacher_id)
);

CREATE TABLE IF NOT EXISTS enrollments (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (student_id, subject_id)
);

CREATE TABLE IF NOT EXISTS marks (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  value NUMERIC(5,2) NOT NULL,
  term VARCHAR(50),
  description VARCHAR(200),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Homework: either MCQ-based (has questions) or file-based (Drive link)
CREATE TABLE IF NOT EXISTS homework (
  id SERIAL PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  type VARCHAR(10) NOT NULL CHECK (type IN ('mcq', 'file')),
  due_date TIMESTAMP NOT NULL,
  duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 1 AND 600), -- NULL = no time limit
  created_at TIMESTAMP DEFAULT NOW()
);

-- 1 to 5 templates (full question sets) per MCQ homework; each student is randomly given one
CREATE TABLE IF NOT EXISTS homework_templates (
  id SERIAL PRIMARY KEY,
  homework_id INTEGER NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  position SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 5),
  UNIQUE (homework_id, position)
);

-- MCQ questions belonging to a homework template
CREATE TABLE IF NOT EXISTS homework_questions (
  id SERIAL PRIMARY KEY,
  homework_id INTEGER NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  template_id INTEGER REFERENCES homework_templates(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  option_a VARCHAR(300),
  option_b VARCHAR(300),
  option_c VARCHAR(300),
  option_d VARCHAR(300),
  correct_option CHAR(1) NOT NULL CHECK (correct_option IN ('a','b','c','d')),
  order_index INTEGER DEFAULT 0
);

-- Student answers to MCQ homework
CREATE TABLE IF NOT EXISTS homework_answers (
  id SERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES homework_questions(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  selected_option CHAR(1) NOT NULL CHECK (selected_option IN ('a','b','c','d')),
  is_correct BOOLEAN NOT NULL,
  submitted_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (question_id, student_id)
);

-- MCQ attempts. attempt_no = 1 is the official attempt (the only one that counts);
-- attempt_no >= 2 are practice attempts on any template.
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

-- File-based homework submissions (Drive link only, no file stored in DB)
CREATE TABLE IF NOT EXISTS homework_submissions (
  id SERIAL PRIMARY KEY,
  homework_id INTEGER NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  drive_file_id TEXT NOT NULL,
  drive_file_link TEXT NOT NULL,
  submitted_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (homework_id, student_id)
);

CREATE TABLE IF NOT EXISTS exams (
  id SERIAL PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  exam_date DATE NOT NULL,
  exam_time TIME,
  scope TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Manual to-do/activity items, teacher-authored, scoped to a subject and date.
-- Students see only items for subjects they're enrolled in (via enrollments join).
CREATE TABLE IF NOT EXISTS todos (
  id SERIAL PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  description VARCHAR(300) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Announcements: posted by a teacher (to one of their subjects) or by an admin
-- (to everyone, or to one grade / grade+section). subject_id NULL = school-wide / grade-wide.
CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
  grade VARCHAR(50),
  classroom_section VARCHAR(10),
  title VARCHAR(200) NOT NULL,
  body TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- One row per user per event (homework, exam, todo, mark, announcement)
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('announcement', 'homework', 'exam', 'todo', 'mark')),
  title VARCHAR(200) NOT NULL,
  body TEXT,
  ref_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  read_at TIMESTAMP
);

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_subjects_teacher ON subjects(teacher_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_subject ON enrollments(subject_id);
CREATE INDEX IF NOT EXISTS idx_marks_student ON marks(student_id);
CREATE INDEX IF NOT EXISTS idx_marks_subject ON marks(subject_id);
CREATE INDEX IF NOT EXISTS idx_homework_subject ON homework(subject_id);
CREATE INDEX IF NOT EXISTS idx_hw_templates_homework ON homework_templates(homework_id);
CREATE INDEX IF NOT EXISTS idx_hw_questions_template ON homework_questions(template_id);
CREATE INDEX IF NOT EXISTS idx_hw_attempts_homework ON homework_attempts(homework_id);
CREATE INDEX IF NOT EXISTS idx_hw_attempts_student ON homework_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_exams_subject ON exams(subject_id);
CREATE INDEX IF NOT EXISTS idx_todos_subject ON todos(subject_id);
CREATE INDEX IF NOT EXISTS idx_todos_date ON todos(activity_date);
CREATE INDEX IF NOT EXISTS idx_announcements_subject ON announcements(subject_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
