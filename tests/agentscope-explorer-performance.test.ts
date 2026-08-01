// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { TraceExplorer } from "../components/agentscope/trace-explorer";
import type { RunProjection } from "../lib/agentscope/domain/projection";
import type { Span } from "../lib/agentscope/domain/span";

function thousandSpanProjection(): RunProjection {
  const startedAt = Date.parse("2026-07-28T08:00:00.000Z");
  const spans: Span[] = Array.from({ length: 1_000 }, (_, index) => ({
    id: index === 0 ? "span-root" : `span-${index}`,
    runId: "run-1000-spans",
    parentSpanId: index === 0 ? undefined : "span-root",
    kind: index === 0 ? "agent" : index % 4 === 0 ? "model" : "custom",
    name: index === 0 ? "performance-root" : `performance-span-${index}`,
    status: "success",
    sequence: index + 3,
    startedAt: new Date(startedAt + index).toISOString(),
    endedAt: new Date(startedAt + index + 1).toISOString(),
    attributes: {},
    metrics: { durationMs: 1 },
    schemaVersion: 1,
  }));

  return {
    run: {
      id: "run-1000-spans",
      projectId: "agentscope-performance",
      name: "1,000 span fixture",
      status: "success",
      taskType: "performance_fixture",
      taskInputHash: "aaaaaaaaaaaaaaaa",
      configSnapshot: {
        provider: "mock",
        promptVersion: "fixture-v1",
        modelParameters: {},
        toolVersions: {},
      },
      environmentFingerprint: {
        harnessVersion: "0.3.0",
        runtime: "test",
        fingerprint: "perf000000000001",
      },
      rootSpanId: "span-root",
      createdAt: new Date(startedAt - 2).toISOString(),
      startedAt: new Date(startedAt - 1).toISOString(),
      completedAt: new Date(startedAt + 1_001).toISOString(),
      schemaVersion: 1,
    },
    spans,
    artifacts: [],
    checkpoints: [],
    lastSequence: 2_002,
    dataQualityIssues: [],
  };
}

afterEach(cleanup);

describe("Trace Explorer performance fixture", () => {
  it("renders and filters 1,000 spans within the PRD first-screen budget", () => {
    const startedAt = performance.now();
    render(createElement(TraceExplorer, {
      events: [],
      projection: thousandSpanProjection(),
      isRunning: false,
      provider: "mock",
      isForking: false,
      onForkSpan: async () => true,
      replayMode: "fixture",
    }));
    const elapsedMs = performance.now() - startedAt;

    expect(screen.getAllByRole("treeitem")).toHaveLength(1_000);
    expect(elapsedMs).toBeLessThan(2_000);

    fireEvent.change(screen.getByPlaceholderText("Filter spans"), {
      target: { value: "performance-span-999" },
    });
    expect(screen.getAllByRole("treeitem")).toHaveLength(2);
    expect(screen.getByText("2/1000 visible")).toBeDefined();
  });
});
