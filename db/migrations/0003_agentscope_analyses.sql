BEGIN;

CREATE TABLE IF NOT EXISTS agentscope_analyses (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES agentscope_runs(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL CHECK (analysis_type IN ('diagnostics', 'eval')),
  algorithm_version TEXT NOT NULL,
  input_trace_sequence INTEGER NOT NULL CHECK (input_trace_sequence > 0),
  analysis_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (run_id, analysis_type, algorithm_version, input_trace_sequence)
);

CREATE INDEX IF NOT EXISTS agentscope_analyses_run_created_idx
  ON agentscope_analyses (run_id, created_at DESC);

INSERT INTO agentscope_schema_migrations (version)
VALUES ('0003_agentscope_analyses')
ON CONFLICT (version) DO NOTHING;

COMMIT;
