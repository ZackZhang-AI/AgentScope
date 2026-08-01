import { describe, expect, it } from "vitest";
import { GET } from "../app/api/v1/demo-runs/route";
import { traceEventSchema } from "../lib/agentscope/domain/event";

describe("GET /api/v1/demo-runs", () => {
  it("returns three stable offline fixtures with branch provenance", async () => {
    const response = GET();
    const payload = await response.json();

    expect(payload.schemaVersion).toBe(1);
    expect(payload.runs).toHaveLength(3);
    expect(
      payload.runs.every((run: { events: unknown[] }) =>
        run.events.every((event) => traceEventSchema.safeParse(event).success),
      ),
    ).toBe(true);
    const parent = payload.runs.find(
      (run: { slug: string }) => run.slug === "failed-repeated-tool",
    );
    const child = payload.runs.find(
      (run: { slug: string }) => run.slug === "forked-successful-code-audit",
    );
    expect(child.result.trace.run).toMatchObject({
      parentRunId: parent.result.id,
      forkedFromSpanId: "span_failure_tool_1",
    });
    expect(parent.result.trace.spans.filter(
      (span: { name: string }) => span.name === "search_repository",
    )).toHaveLength(3);
  });
});
