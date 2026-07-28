import { describe, expect, it, vi } from "vitest";
import { GET as listRuns } from "../app/api/v1/runs/route";
import { GET as getRun } from "../app/api/v1/runs/[runId]/route";
import { GET as listEvents } from "../app/api/v1/runs/[runId]/events/route";

describe("AgentScope run APIs without persistent storage", () => {
  it("returns an explicit configuration response for the run list", async () => {
    vi.stubEnv("DATABASE_URL", "");

    const response = await listRuns(
      new Request("http://localhost/api/v1/runs"),
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.code).toBe("TRACE_STORAGE_NOT_CONFIGURED");
  });

  it("returns an explicit configuration response for run details", async () => {
    vi.stubEnv("DATABASE_URL", "");

    const response = await getRun(
      new Request("http://localhost/api/v1/runs/run_1"),
      { params: Promise.resolve({ runId: "run_1" }) },
    );

    expect(response.status).toBe(503);
  });

  it("returns an explicit configuration response for event history", async () => {
    vi.stubEnv("DATABASE_URL", "");

    const response = await listEvents(
      new Request("http://localhost/api/v1/runs/run_1/events?after=2"),
      { params: Promise.resolve({ runId: "run_1" }) },
    );

    expect(response.status).toBe(503);
  });
});
