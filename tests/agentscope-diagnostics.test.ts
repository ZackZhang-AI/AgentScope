import { describe, expect, it } from "vitest";
import failedFixture from "./fixtures/traces/failed-repeated-tool.json";
import successfulFixture from "./fixtures/traces/successful-code-audit.json";
import { projectTraceEvents } from "../lib/agentscope/domain";
import { diagnoseRun } from "../lib/agentscope/diagnostics/diagnose-run";

describe("AgentScope deterministic diagnostics", () => {
  it("identifies the earliest error and normalized duplicate tool calls", () => {
    const diagnostics = diagnoseRun(projectTraceEvents(failedFixture.events));
    const error = diagnostics.find((item) => item.ruleId === "first-unrecovered-error");
    const duplicate = diagnostics.find((item) => item.ruleId === "duplicate-tool-call");

    expect(error?.evidenceSpanIds[0]).toBe("span_failure_tool_1");
    expect(error?.title).toBe("Possible failure starting point");
    expect(duplicate).toMatchObject({
      severity: "error",
      category: "loop",
      confidence: 0.98,
    });
    expect(duplicate?.evidenceSpanIds).toEqual([
      "span_failure_tool_1",
      "span_failure_tool_2",
      "span_failure_tool_3",
    ]);
  });

  it("reports latency and token hotspots only from measured data", () => {
    const diagnostics = diagnoseRun(projectTraceEvents(successfulFixture.events));

    expect(diagnostics.find((item) => item.ruleId === "latency-hotspot")?.evidenceSpanIds)
      .toEqual(["span_success_model"]);
    expect(diagnostics.find((item) => item.ruleId === "token-hotspot")?.explanation)
      .toContain("150 reported tokens");
    expect(diagnostics.some((item) => item.ruleId === "duplicate-tool-call")).toBe(false);
  });
});
