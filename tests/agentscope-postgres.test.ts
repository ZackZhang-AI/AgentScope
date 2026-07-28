import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "pg";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import failedFixture from "./fixtures/traces/failed-repeated-tool.json";
import forkedFixture from "./fixtures/traces/forked-successful-code-audit.json";
import successfulFixture from "./fixtures/traces/successful-code-audit.json";
import {
  traceEventSchema,
  traceFixtureSchema,
} from "../lib/agentscope/domain";
import {
  PostgresTraceRepository,
  TraceEventConflictError,
} from "../lib/agentscope/infrastructure/postgres/postgres-trace-repository";
import { closeDatabasePool } from "../lib/agentscope/infrastructure/postgres/database";
import { POST as runAudit } from "../app/api/audit/route";
import { POST as forkRun } from "../app/api/v1/runs/[runId]/fork/route";
import type { AuditStreamMessage } from "../lib/types";

const databaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)("PostgresTraceRepository", () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  const repository = new PostgresTraceRepository(pool);

  beforeAll(async () => {
    const migration = await readFile(
      resolve("db/migrations/0001_agentscope_trace.sql"),
      "utf8",
    );
    await pool.query(migration);
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM agentscope_trace_events");
    await pool.query("DELETE FROM agentscope_runs");
  });

  afterAll(async () => {
    await closeDatabasePool();
    await pool.end();
  });

  it("persists an immutable event stream and current projection", async () => {
    const fixture = traceFixtureSchema.parse(successfulFixture);
    const result = await repository.appendMany(fixture.events);
    const stored = await repository.getProjection("run_success_001");
    const eventsAfterPlan = await repository.listEventsAfter(
      "run_success_001",
      5,
    );

    expect(result.inserted).toBe(fixture.events.length);
    expect(result.duplicates).toBe(0);
    expect(stored?.run.status).toBe("success");
    expect(stored?.spans).toHaveLength(5);
    expect(eventsAfterPlan[0].sequence).toBe(6);
    expect(eventsAfterPlan.at(-1)?.sequence).toBe(15);
  });

  it("treats the same event as idempotent and rejects conflicting content", async () => {
    const fixture = traceFixtureSchema.parse(successfulFixture);
    await repository.appendMany(fixture.events);

    const duplicate = await repository.append(fixture.events[0]);
    expect(duplicate).toMatchObject({ inserted: 0, duplicates: 1 });

    const conflict = traceEventSchema.parse({
      ...fixture.events[0],
      occurredAt: "2026-07-28T02:00:01.000Z",
    });
    await expect(repository.append(conflict)).rejects.toBeInstanceOf(
      TraceEventConflictError,
    );
  });

  it("stores parent and child runs with queryable branch provenance", async () => {
    await repository.appendMany(
      traceFixtureSchema.parse(failedFixture).events,
    );
    await repository.appendMany(
      traceFixtureSchema.parse(forkedFixture).events,
    );

    const runs = await repository.listRuns({
      projectId: "project_harnesslab",
    });
    const child = runs.find((run) => run.id === "run_fork_001");

    expect(runs).toHaveLength(2);
    expect(child).toMatchObject({
      status: "success",
      parentRunId: "run_failure_001",
      forkedFromSpanId: "span_failure_tool_1",
    });
    expect(
      runs.find((run) => run.id === "run_failure_001")?.errorCount,
    ).toBe(4);
  });

  it("persists the real audit API trace when DATABASE_URL is configured", async () => {
    vi.stubEnv("DATABASE_URL", databaseUrl);
    const response = await runAudit(
      new Request("http://localhost/api/audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content: "const value = userInput;",
          inputType: "files",
          provider: "mock",
          intensity: "quick",
          rules: ["security"],
        }),
      }),
    );
    const result = await response.json();
    const stored = await repository.getProjection(result.id);

    expect(response.status).toBe(200);
    expect(stored?.run.id).toBe(result.id);
    expect(stored?.run.status).toBe(result.trace.run.status);
    expect(stored?.spans.length).toBe(result.trace.spans.length);
  });

  it("persists a fork as a separate child without mutating its parent", async () => {
    vi.stubEnv("DATABASE_URL", databaseUrl);
    const requestBody = {
      content: "const value = userInput;",
      inputType: "files",
      provider: "mock",
      intensity: "quick",
      rules: ["security"],
    };
    const parentResponse = await runAudit(
      new Request("http://localhost/api/audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody),
      }),
    );
    const parent = await parentResponse.json();
    const parentBefore = await repository.getProjection(parent.id);
    const target = parent.trace.spans.find(
      (span: { name: string }) => span.name === "provider-inspection",
    );

    const response = await forkRun(
      new Request(`http://localhost/api/v1/runs/${parent.id}/fork`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetSpanId: target.id,
          request: requestBody,
        }),
      }),
      { params: Promise.resolve({ runId: parent.id }) },
    );
    const messages = (await response.text())
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => JSON.parse(line.slice(6)) as AuditStreamMessage);
    const result = messages.find(
      (message): message is Extract<AuditStreamMessage, { type: "result" }> =>
        message.type === "result",
    )?.result;
    const child = result ? await repository.getProjection(result.id) : null;
    const parentAfter = await repository.getProjection(parent.id);

    expect(response.status).toBe(200);
    expect(child?.run).toMatchObject({
      parentRunId: parent.id,
      forkedFromSpanId: target.id,
    });
    expect(child?.spans.some((span) => span.name === "checkpoint-restore")).toBe(true);
    expect(parentAfter).toEqual(parentBefore);
  });
});
