import { describe, expect, it } from "vitest";
import successfulFixture from "../fixtures/agentscope/successful-code-audit.json";
import { projectTraceEvents } from "../lib/agentscope/domain";
import {
  flattenSpanTree,
  formatDuration,
  getTimelineBar,
  getTraceBounds,
  getTimelineViewportBar,
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

  it("collapses descendants and preserves ancestor paths while filtering", () => {
    const collapsed = flattenSpanTree(projection.spans, {
      collapsedSpanIds: new Set(["span_success_model"]),
    });
    expect(collapsed.some((row) => row.span.id === "span_success_tool")).toBe(false);

    const filtered = flattenSpanTree(projection.spans, {
      collapsedSpanIds: new Set(["span_success_model"]),
      filter: { kind: "tool", query: "read_file" },
    });
    expect(filtered.map((row) => row.span.id)).toEqual([
      "span_success_root",
      "span_success_model",
      "span_success_tool",
    ]);
    expect(filtered.find((row) => row.span.id === "span_success_model")?.isExpanded).toBe(true);
  });

  it("clips timeline bars to the zoomed viewport", () => {
    expect(getTimelineViewportBar(
      { offsetPercent: 40, widthPercent: 20, durationMs: 10 },
      2,
      25,
    )).toMatchObject({ offsetPercent: 30, widthPercent: 40 });
    expect(getTimelineViewportBar(
      { offsetPercent: 0, widthPercent: 10, durationMs: 10 },
      2,
      50,
    )).toBeNull();
  });
});
