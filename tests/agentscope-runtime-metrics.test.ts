import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "../app/api/v1/system/metrics/route";
import {
  getRuntimeMetrics,
  incrementRuntimeMetric,
  resetRuntimeMetricsForTests,
} from "../lib/agentscope/observability/runtime-metrics";

describe("AgentScope process observability", () => {
  beforeEach(() => resetRuntimeMetricsForTests());

  it("counts product reliability events without exposing request payloads", async () => {
    incrementRuntimeMetric("runs_started");
    incrementRuntimeMetric("trace_events_persisted", 3);
    incrementRuntimeMetric("sse_resume_requests");

    const snapshot = getRuntimeMetrics();
    const response = await GET();
    const payload = await response.json();

    expect(snapshot.counters).toMatchObject({
      runs_started: 1,
      trace_events_persisted: 3,
      sse_resume_requests: 1,
    });
    expect(payload.schemaVersion).toBe(1);
    expect(payload.scope).toBe("process");
    expect(JSON.stringify(payload)).not.toContain("inputRef");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
