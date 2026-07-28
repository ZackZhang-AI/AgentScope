BEGIN;

ALTER TABLE agentscope_runs
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS agentscope_runs_tags_idx
  ON agentscope_runs USING GIN (tags);

INSERT INTO agentscope_schema_migrations (version)
VALUES ('0002_agentscope_run_metadata')
ON CONFLICT (version) DO NOTHING;

COMMIT;
