-- School Portal Database Schema
-- Postgres (Supabase/Neon)

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(10) NOT NULL CHECK (role IN ('teacher', 'student')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE subjects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE enrollments (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (student_id, subject_id)
);

CREATE TABLE marks (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  value NUMERIC(5,2) NOT NULL,
  term VARCHAR(50),
  description VARCHAR(200),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Homework: either MCQ-based (has questions) or file-based (Drive link)
CREATE TABLE homework (
  id SERIAL PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  type VARCHAR(10) NOT NULL CHECK (type IN ('mcq', 'file')),
  due_date TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- MCQ questions belonging to a homework set
CREATE TABLE homework_questions (
  id SERIAL PRIMARY KEY,
  homework_id INTEGER NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  option_a VARCHAR(300),
  option_b VARCHAR(300),
  option_c VARCHAR(300),
  option_d VARCHAR(300),
  correct_option CHAR(1) NOT NULL CHECK (correct_option IN ('a','b','c','d')),
  order_index INTEGER DEFAULT 0
);

-- Student answers to MCQ homework
CREATE TABLE homework_answers (
  id SERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES homework_questions(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  selected_option CHAR(1) NOT NULL CHECK (selected_option IN ('a','b','c','d')),
  is_correct BOOLEAN NOT NULL,
  submitted_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (question_id, student_id)
);

-- File-based homework submissions (Drive link only, no file stored in DB)
CREATE TABLE homework_submissions (
  id SERIAL PRIMARY KEY,
  homework_id INTEGER NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  drive_file_id TEXT NOT NULL,
  drive_file_link TEXT NOT NULL,
  submitted_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (homework_id, student_id)
);

CREATE TABLE exams (
  id SERIAL PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  exam_date DATE NOT NULL,
  exam_time TIME,
  scope TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for common lookups
CREATE INDEX idx_subjects_teacher ON subjects(teacher_id);
CREATE INDEX idx_enrollments_student ON enrollments(student_id);
CREATE INDEX idx_enrollments_subject ON enrollments(subject_id);
CREATE INDEX idx_marks_student ON marks(student_id);
CREATE INDEX idx_marks_subject ON marks(subject_id);
CREATE INDEX idx_homework_subject ON homework(subject_id);
CREATE INDEX idx_exams_subject ON exams(subject_id);
