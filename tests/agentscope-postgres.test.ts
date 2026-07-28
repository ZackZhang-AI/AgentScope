import { readdir, readFile } from "node:fs/promises";
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
import failedFixture from "../fixtures/agentscope/failed-repeated-tool.json";
import forkedFixture from "../fixtures/agentscope/forked-successful-code-audit.json";
import successfulFixture from "../fixtures/agentscope/successful-code-audit.json";
import {
  traceEventSchema,
  traceFixtureSchema,
} from "../lib/agentscope/domain";
import {
  PostgresTraceRepository,
  TraceEventConflictError,
} from "../lib/agentscope/infrastructure/postgres/postgres-trace-repository";
import { recoverInterruptedRuns } from "../lib/agentscope/application/recover-interrupted-runs";
import { closeDatabasePool } from "../lib/agentscope/infrastructure/postgres/database";
import { POST as runAudit } from "../app/api/audit/route";
import { POST as forkRun } from "../app/api/v1/runs/[runId]/fork/route";
import type { AuditStreamMessage } from "../lib/types";

const databaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)("PostgresTraceRepository", () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  const repository = new PostgresTraceRepository(pool);

  beforeAll(async () => {
    const migrationDirectory = resolve("db/migrations");
    const migrations = (await readdir(migrationDirectory))
      .filter((filename) => /^\d+_.+\.sql$/.test(filename))
      .sort();
    for (const migration of migrations) {
      await pool.query(
        await readFile(resolve(migrationDirectory, migration), "utf8"),
      );
    }
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

  it("recovers a stale running projection into an auditable error terminal", async () => {
    const fixture = traceFixtureSchema.parse(successfulFixture);
    await repository.appendMany(
      fixture.events.filter((event) => event.sequence <= 9),
    );
    await pool.query(
      "UPDATE agentscope_runs SET updated_at = NOW() - INTERVAL '10 minutes'",
    );

    const result = await recoverInterruptedRuns(repository, {
      staleBefore: new Date(Date.now() - 5 * 60_000).toISOString(),
      recoveredAt: "2026-07-28T12:00:00.000Z",
    });
    const recovered = await repository.getProjection("run_success_001");

    expect(result.recoveredRunIds).toEqual(["run_success_001"]);
    expect(recovered?.run.status).toBe("error");
    expect(
      recovered?.spans.some(
        (span) => span.error?.type === "runner_interrupted",
      ),
    ).toBe(true);
    expect(recovered?.dataQualityIssues).toHaveLength(0);
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

  it("filters runs and updates mutable display metadata without changing trace facts", async () => {
    await repository.appendMany(
      traceFixtureSchema.parse(successfulFixture).events,
    );
    const projectionBefore = await repository.getProjection("run_success_001");

    const updated = await repository.updateRunMetadata("run_success_001", {
      name: "Release audit",
      tags: ["release", "security"],
    });
    const filtered = await repository.listRuns({
      provider: "mock",
      query: "Release",
      sort: "oldest",
    });
    const projectionAfter = await repository.getProjection("run_success_001");

    expect(updated).toMatchObject({
      name: "Release audit",
      tags: ["release", "security"],
    });
    expect(filtered.map((run) => run.id)).toEqual(["run_success_001"]);
    expect(projectionAfter).toEqual(projectionBefore);
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
