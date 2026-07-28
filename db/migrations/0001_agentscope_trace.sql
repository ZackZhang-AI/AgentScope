BEGIN;

CREATE TABLE IF NOT EXISTS agentscope_schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agentscope_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN (
      'queued',
      'running',
      'success',
      'success_with_warnings',
      'error',
      'cancelled'
    )
  ),
  task_type TEXT NOT NULL,
  task_input_hash TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT,
  parent_run_id TEXT REFERENCES agentscope_runs(id) ON DELETE RESTRICT,
  forked_from_span_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  run_snapshot JSONB NOT NULL,
  projection JSONB,
  span_count INTEGER NOT NULL DEFAULT 0 CHECK (span_count >= 0),
  error_count INTEGER NOT NULL DEFAULT 0 CHECK (error_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT agentscope_branch_provenance CHECK (
    (parent_run_id IS NULL AND forked_from_span_id IS NULL)
    OR
    (parent_run_id IS NOT NULL AND forked_from_span_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS agentscope_trace_events (
  event_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES agentscope_runs(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL CHECK (sequence > 0),
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  event_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (run_id, sequence)
);

CREATE INDEX IF NOT EXISTS agentscope_runs_project_created_idx
  ON agentscope_runs (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS agentscope_runs_status_created_idx
  ON agentscope_runs (status, created_at DESC);

CREATE INDEX IF NOT EXISTS agentscope_runs_parent_idx
  ON agentscope_runs (parent_run_id)
  WHERE parent_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS agentscope_events_run_sequence_idx
  ON agentscope_trace_events (run_id, sequence);

INSERT INTO agentscope_schema_migrations (version)
VALUES ('0001_agentscope_trace')
ON CONFLICT (version) DO NOTHING;

COMMIT;
