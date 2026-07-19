CREATE TABLE IF NOT EXISTS feedback_events (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  visitor_id TEXT,
  prompt_id TEXT NOT NULL,
  page_path TEXT NOT NULL,
  calculator_key TEXT,
  event_type TEXT NOT NULL,
  rating TEXT,
  language TEXT,
  device_type TEXT,
  app_version TEXT,
  commit_sha TEXT
);

CREATE INDEX IF NOT EXISTS idx_feedback_events_created_at ON feedback_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_events_event_type ON feedback_events (event_type);
CREATE INDEX IF NOT EXISTS idx_feedback_events_calculator_key ON feedback_events (calculator_key);
CREATE INDEX IF NOT EXISTS idx_feedback_events_prompt_id ON feedback_events (prompt_id);
CREATE INDEX IF NOT EXISTS idx_feedback_events_visitor_created_at ON feedback_events (visitor_id, created_at DESC);
