BEGIN;

CREATE TABLE IF NOT EXISTS agentscope_artifacts (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES agentscope_runs(id) ON DELETE CASCADE,
  span_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('diff', 'text', 'json')),
  media_type TEXT NOT NULL CHECK (
    media_type IN ('text/x-diff', 'text/plain', 'application/json')
  ),
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0 AND size_bytes <= 262144),
  redaction_state TEXT NOT NULL CHECK (
    redaction_state IN ('clean', 'redacted', 'blocked')
  ),
  visibility TEXT NOT NULL CHECK (visibility IN ('user', 'internal')),
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS agentscope_artifacts_run_created_idx
  ON agentscope_artifacts (run_id, created_at);

INSERT INTO agentscope_schema_migrations (version)
VALUES ('0004_agentscope_artifacts')
ON CONFLICT (version) DO NOTHING;

COMMIT;
