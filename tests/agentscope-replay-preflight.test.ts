import { describe, expect, it } from "vitest";
import failedFixture from "./fixtures/traces/failed-repeated-tool.json";
import successfulFixture from "./fixtures/traces/successful-code-audit.json";
import { projectTraceEvents } from "../lib/agentscope/domain";
import { buildReplayPreflight } from "../lib/agentscope/replay/preflight";

describe("AgentScope replay preflight", () => {
  it("allows a complete read-only checkpoint", () => {
    const projection = projectTraceEvents(failedFixture.events);
    const preflight = buildReplayPreflight(projection, "span_failure_tool_1");

    expect(preflight.status).toBe("ready");
    expect(preflight.checkpointId).toBe("checkpoint_failure_tool");
    expect(preflight.actions.filter((action) => action.kind === "tool")).toHaveLength(3);
    expect(preflight.actions.every((action) => action.policy === "execute")).toBe(true);
  });

  it("blocks a span without a matching checkpoint", () => {
    const projection = projectTraceEvents(successfulFixture.events);
    const preflight = buildReplayPreflight(projection, "span_success_model");

    expect(preflight.status).toBe("blocked");
    expect(preflight.reasons).toContain("No replay checkpoint was captured for this step.");
  });

  it("uses a fixed response instead of repeating a side effect", () => {
    const projection = projectTraceEvents(failedFixture.events);
    const target = projection.spans.find((span) => span.id === "span_failure_tool_1")!;
    const mutated = {
      ...projection,
      spans: projection.spans.map((span) =>
        span.id === target.id
          ? {
              ...span,
              attributes: { ...span.attributes, "tool.side_effect": "side_effect" },
              outputRef: { kind: "inline" as const, data: { cached: true }, redacted: false },
            }
          : span,
      ),
    };

    const preflight = buildReplayPreflight(mutated, target.id);
    expect(preflight.status).toBe("review_required");
    expect(preflight.actions[0].policy).toBe("fixed_response");
  });
});
