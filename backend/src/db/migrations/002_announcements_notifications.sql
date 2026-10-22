-- Migration 002: announcements + in-app notifications
-- Safe to run more than once. Run it BEFORE deploying the new backend.

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

CREATE INDEX IF NOT EXISTS idx_announcements_subject ON announcements(subject_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;
