import { beforeEach, describe, expect, it, vi } from "vitest";
import successfulFixture from "../fixtures/agentscope/successful-code-audit.json";
import { traceFixtureSchema } from "../lib/agentscope/domain";

const { listEventsAfter } = vi.hoisted(() => ({
  listEventsAfter: vi.fn(),
}));

vi.mock(
  "../lib/agentscope/infrastructure/postgres/database",
  () => ({
    getTraceRepository: () => ({ listEventsAfter }),
  }),
);

import { GET } from "../app/api/v1/runs/[runId]/events/route";

describe("GET /api/v1/runs/:runId/events resumption", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "postgres://configured");
    listEventsAfter.mockReset();
  });

  it("uses Last-Event-ID as the cursor and emits resumable SSE frames", async () => {
    const fixture = traceFixtureSchema.parse(successfulFixture);
    const events = fixture.events.filter((event) => event.sequence > 10);
    listEventsAfter.mockResolvedValue(events);

    const response = await GET(
      new Request("http://localhost/api/v1/runs/run_success_001/events", {
        headers: {
          accept: "text/event-stream",
          "last-event-id": "10",
        },
      }),
      { params: Promise.resolve({ runId: "run_success_001" }) },
    );
    const stream = await response.text();

    expect(listEventsAfter).toHaveBeenCalledWith("run_success_001", 10);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(stream).toContain("id: 11");
    expect(stream).toContain("event: trace_event");
    expect(stream).toContain('"type":"run.ended"');
  });
});
