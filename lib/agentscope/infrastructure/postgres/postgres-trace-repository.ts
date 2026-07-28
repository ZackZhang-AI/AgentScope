import { isDeepStrictEqual } from "node:util";
import type { Pool, PoolClient } from "pg";
import {
  projectTraceEvents,
  runProjectionSchema,
  traceEventSchema,
  type RunProjection,
  type TraceEvent,
} from "../../domain";
import type {
  AppendTraceResult,
  ListRunsInput,
  RunSummary,
  TraceRepository,
} from "../../application/trace-repository";

type EventRow = {
  event_json: unknown;
};

type ProjectionRow = {
  projection: unknown;
};

type RunSummaryRow = {
  id: string;
  project_id: string;
  name: string;
  tags: string[];
  status: RunSummary["status"];
  task_type: string;
  provider: string;
  model: string | null;
  parent_run_id: string | null;
  forked_from_span_id: string | null;
  created_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  span_count: number;
  error_count: number;
};

export class TraceEventConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TraceEventConflictError";
  }
}
export class PostgresTraceRepository implements TraceRepository {
  constructor(private readonly pool: Pool) {}

  append(event: TraceEvent) {
    return this.appendMany([event]);
  }

  async appendMany(input: readonly TraceEvent[]): Promise<AppendTraceResult> {
    if (input.length === 0) {
      throw new Error("appendMany requires at least one trace event.");
    }

    const events = input.map((event) => traceEventSchema.parse(event));
    const runId = events[0].runId;
    if (events.some((event) => event.runId !== runId)) {
      throw new Error("A trace batch can only contain one run.");
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await this.#ensureRun(client, events);
      await client.query(
        "SELECT id FROM agentscope_runs WHERE id = $1 FOR UPDATE",
        [runId],
      );

      let inserted = 0;
      let duplicates = 0;
      for (const event of events) {
        const result = await client.query<{ event_id: string }>(
          `INSERT INTO agentscope_trace_events (
             event_id, run_id, sequence, event_type, occurred_at, received_at, event_json
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (event_id) DO NOTHING
           RETURNING event_id`,
          [
            event.eventId,
            event.runId,
            event.sequence,
            event.type,
            event.occurredAt,
            event.receivedAt,
            event,
          ],
        );

        if (result.rowCount === 1) {
          inserted += 1;
          continue;
        }

        const existing = await client.query<EventRow>(
          "SELECT event_json FROM agentscope_trace_events WHERE event_id = $1",
          [event.eventId],
        );
        if (
          existing.rowCount !== 1 ||
          !isDeepStrictEqual(existing.rows[0].event_json, event)
        ) {
          throw new TraceEventConflictError(
            `Event ${event.eventId} conflicts with an existing event.`,
          );
        }
        duplicates += 1;
      }

      const projection = await this.#projectRun(client, runId);
      await this.#saveProjection(client, projection);
      await client.query("COMMIT");
      return { inserted, duplicates, projection };
    } catch (error) {
      await client.query("ROLLBACK");
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "23505"
      ) {
        throw new TraceEventConflictError(
          `Run ${runId} contains a conflicting event sequence.`,
        );
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async getProjection(runId: string): Promise<RunProjection | null> {
    const result = await this.pool.query<ProjectionRow>(
      "SELECT projection FROM agentscope_runs WHERE id = $1",
      [runId],
    );
    const row = result.rows[0];
    return row?.projection ? runProjectionSchema.parse(row.projection) : null;
  }

  async listEventsAfter(runId: string, sequence: number) {
    const result = await this.pool.query<EventRow>(
      `SELECT event_json
       FROM agentscope_trace_events
       WHERE run_id = $1 AND sequence > $2
       ORDER BY sequence ASC`,
      [runId, sequence],
    );
    return result.rows.map((row) => traceEventSchema.parse(row.event_json));
  }

  async listStaleRunningRunIds(staleBefore: string, limit = 100) {
    const boundedLimit = Math.max(1, Math.min(limit, 500));
    const result = await this.pool.query<{ id: string }>(
      `SELECT id
       FROM agentscope_runs
       WHERE status = 'running' AND updated_at < $1
       ORDER BY updated_at ASC
       LIMIT $2`,
      [staleBefore, boundedLimit],
    );
    return result.rows.map((row) => row.id);
  }

  async listRuns(input: ListRunsInput = {}): Promise<RunSummary[]> {
    const limit = Math.max(1, Math.min(input.limit ?? 50, 100));
    const order = input.sort === "oldest" ? "ASC" : "DESC";
    const result = await this.pool.query<RunSummaryRow>(
      `SELECT
         id, project_id, COALESCE(display_name, name) AS name, tags,
         status, task_type, provider, model,
         parent_run_id, forked_from_span_id, created_at, started_at, completed_at,
         span_count, error_count
       FROM agentscope_runs
       WHERE ($1::text IS NULL OR project_id = $1)
         AND ($2::text IS NULL OR status = $2)
         AND ($3::text IS NULL OR provider = $3)
         AND (
           $4::text IS NULL
           OR id ILIKE '%' || $4 || '%'
           OR COALESCE(display_name, name) ILIKE '%' || $4 || '%'
           OR COALESCE(model, '') ILIKE '%' || $4 || '%'
         )
         AND ($5::timestamptz IS NULL OR created_at >= $5)
         AND ($6::timestamptz IS NULL OR created_at <= $6)
       ORDER BY created_at ${order}
       LIMIT $7`,
      [
        input.projectId ?? null,
        input.status ?? null,
        input.provider ?? null,
        input.query ?? null,
        input.createdAfter ?? null,
        input.createdBefore ?? null,
        limit,
      ],
    );

    return result.rows.map((row) => this.#toRunSummary(row));
  }

  async updateRunMetadata(
    runId: string,
    input: { name?: string; tags?: string[] },
  ): Promise<RunSummary | null> {
    const result = await this.pool.query<RunSummaryRow>(
      `UPDATE agentscope_runs
       SET display_name = COALESCE($2, display_name),
           tags = COALESCE($3, tags),
           updated_at = NOW()
       WHERE id = $1
       RETURNING
         id, project_id, COALESCE(display_name, name) AS name, tags,
         status, task_type, provider, model,
         parent_run_id, forked_from_span_id, created_at, started_at, completed_at,
         span_count, error_count`,
      [runId, input.name ?? null, input.tags ?? null],
    );
    return result.rows[0] ? this.#toRunSummary(result.rows[0]) : null;
  }

  #toRunSummary(row: RunSummaryRow): RunSummary {
    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      tags: row.tags,
      status: row.status,
      taskType: row.task_type,
      provider: row.provider,
      model: row.model ?? undefined,
      parentRunId: row.parent_run_id ?? undefined,
      forkedFromSpanId: row.forked_from_span_id ?? undefined,
      createdAt: row.created_at.toISOString(),
      startedAt: row.started_at?.toISOString(),
      completedAt: row.completed_at?.toISOString(),
      spanCount: row.span_count,
      errorCount: row.error_count,
    };
  }

  async #ensureRun(client: PoolClient, events: TraceEvent[]) {
    const created = events.find((event) => event.type === "run.created");
    if (created?.type === "run.created") {
      const run = created.payload.run;
      await client.query(
        `INSERT INTO agentscope_runs (
           id, project_id, name, status, task_type, task_input_hash,
           provider, model, parent_run_id, forked_from_span_id,
           created_at, run_snapshot
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO NOTHING`,
        [
          run.id,
          run.projectId,
          run.name,
          run.status,
          run.taskType,
          run.taskInputHash,
          run.configSnapshot.provider,
          run.configSnapshot.model ?? null,
          run.parentRunId ?? null,
          run.forkedFromSpanId ?? null,
          run.createdAt,
          run,
        ],
      );
    }

    const existing = await client.query<{ id: string }>(
      "SELECT id FROM agentscope_runs WHERE id = $1",
      [events[0].runId],
    );
    if (existing.rowCount !== 1) {
      throw new Error(
        `Run ${events[0].runId} must be created before appending trace events.`,
      );
    }
  }

  async #projectRun(client: PoolClient, runId: string) {
    const result = await client.query<EventRow>(
      `SELECT event_json
       FROM agentscope_trace_events
       WHERE run_id = $1
       ORDER BY sequence ASC`,
      [runId],
    );
    return projectTraceEvents(result.rows.map((row) => row.event_json));
  }

  async #saveProjection(client: PoolClient, projection: RunProjection) {
    const run = projection.run;
    const errorCount = projection.spans.filter(
      (span) => span.status === "error",
    ).length;
    await client.query(
      `UPDATE agentscope_runs
       SET status = $2,
           name = $3,
           model = $4,
           started_at = $5,
           completed_at = $6,
           projection = $7,
           span_count = $8,
           error_count = $9,
           updated_at = NOW()
       WHERE id = $1`,
      [
        run.id,
        run.status,
        run.name,
        run.configSnapshot.model ?? null,
        run.startedAt ?? null,
        run.completedAt ?? null,
        projection,
        projection.spans.length,
        errorCount,
      ],
    );
  }
}
