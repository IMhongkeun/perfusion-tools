CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  visitor_id TEXT,
  page_path TEXT NOT NULL,
  calculator_key TEXT,
  rating TEXT,
  category TEXT NOT NULL,
  message TEXT,
  email TEXT,
  language TEXT,
  device_type TEXT,
  app_version TEXT,
  commit_sha TEXT,
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'open'
);

CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_priority ON feedback (priority);
CREATE INDEX IF NOT EXISTS idx_feedback_category ON feedback (category);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback (status);
CREATE INDEX IF NOT EXISTS idx_feedback_visitor_created_at ON feedback (visitor_id, created_at DESC);
