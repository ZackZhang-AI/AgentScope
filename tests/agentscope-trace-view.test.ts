import { describe, expect, it } from "vitest";
import successfulFixture from "./fixtures/traces/successful-code-audit.json";
import { projectTraceEvents } from "../lib/agentscope/domain";
import {
  flattenSpanTree,
  formatDuration,
  getTimelineBar,
  getTraceBounds,
} from "../lib/agentscope/presentation/trace-view";

describe("AgentScope trace view", () => {
  const projection = projectTraceEvents(successfulFixture.events);

  it("flattens spans in stable parent-first order", () => {
    const rows = flattenSpanTree(projection.spans);

    expect(rows[0]).toMatchObject({
      depth: 0,
      span: { id: "span_success_root" },
    });
    expect(rows.find((row) => row.span.id === "span_success_tool")?.depth).toBe(2);
    expect(new Set(rows.map((row) => row.span.id)).size).toBe(projection.spans.length);
  });

  it("maps span timing into bounded relative bars", () => {
    const bounds = getTraceBounds(projection.spans);

    for (const span of projection.spans) {
      const bar = getTimelineBar(span, bounds);
      expect(bar.offsetPercent).toBeGreaterThanOrEqual(0);
      expect(bar.offsetPercent).toBeLessThanOrEqual(100);
      expect(bar.widthPercent).toBeGreaterThan(0);
      expect(bar.offsetPercent + Math.min(bar.widthPercent, 100 - bar.offsetPercent)).toBeLessThanOrEqual(100);
    }
  });

  it("formats millisecond and second durations", () => {
    expect(formatDuration(92)).toBe("92 ms");
    expect(formatDuration(1_250)).toBe("1.25 s");
    expect(formatDuration()).toBe("Running");
  });
});
