import { describe, expect, it, vi } from "vitest";
import successfulFixture from "../fixtures/agentscope/successful-code-audit.json";
import {
  projectTraceEvents,
  traceFixtureSchema,
  type RunProjection,
  type TraceEvent,
} from "../lib/agentscope/domain";
import {
  buildInterruptedRecoveryEvents,
  recoverInterruptedRuns,
} from "../lib/agentscope/application/recover-interrupted-runs";
import type { TraceRepository } from "../lib/agentscope/application/trace-repository";

function runningProjection() {
  const fixture = traceFixtureSchema.parse(successfulFixture);
  return projectTraceEvents(
    fixture.events.filter((event) => event.sequence <= 9),
  );
}

describe("interrupted run recovery", () => {
  it("closes open spans before marking a stale run as runner-interrupted", () => {
    const projection = runningProjection();
    const recoveredAt = "2026-07-28T12:00:00.000Z";
    const recoveryEvents = buildInterruptedRecoveryEvents(
      projection,
      recoveredAt,
    );
    const recovered = projectTraceEvents([
      ...traceFixtureSchema.parse(successfulFixture).events.slice(
        0,
        projection.lastSequence,
      ),
      ...recoveryEvents,
    ]);

    expect(recoveryEvents.at(-1)?.type).toBe("run.ended");
    expect(recovered.run.status).toBe("error");
    expect(recovered.run.completedAt).toBe(recoveredAt);
    expect(recovered.spans.every((span) => span.status !== "running")).toBe(true);
    expect(
      recovered.spans.some(
        (span) => span.error?.type === "runner_interrupted",
      ),
    ).toBe(true);
    expect(recovered.dataQualityIssues).toHaveLength(0);
  });

  it("recovers stale candidates independently and reports conflicts", async () => {
    const projection = runningProjection();
    const appended: TraceEvent[][] = [];
    const repository: TraceRepository = {
      append: vi.fn(),
      appendMany: vi.fn(async (events) => {
        if (events[0]?.runId === "run_conflict") throw new Error("conflict");
        appended.push([...events]);
        return {
          inserted: events.length,
          duplicates: 0,
          projection,
        };
      }),
      getProjection: vi.fn(async (runId): Promise<RunProjection | null> => ({
        ...projection,
        run: { ...projection.run, id: runId },
        spans: projection.spans.map((span) => ({ ...span, runId })),
      })),
      listEventsAfter: vi.fn(),
      listStaleRunningRunIds: vi.fn(async () => [
        projection.run.id,
        "run_conflict",
      ]),
      listRuns: vi.fn(),
      updateRunMetadata: vi.fn(),
    };

    const result = await recoverInterruptedRuns(repository, {
      staleBefore: "2026-07-28T11:55:00.000Z",
      recoveredAt: "2026-07-28T12:00:00.000Z",
    });

    expect(result).toEqual({
      candidates: 2,
      recoveredRunIds: [projection.run.id],
      failedRunIds: ["run_conflict"],
    });
    expect(appended).toHaveLength(1);
  });

  it("does not emit recovery events for a terminal run", () => {
    const fixture = traceFixtureSchema.parse(successfulFixture);
    const projection = projectTraceEvents(fixture.events);
    expect(
      buildInterruptedRecoveryEvents(
        projection,
        "2026-07-28T12:00:00.000Z",
      ),
    ).toEqual([]);
  });
});
