import { describe, expect, it } from "vitest";
import failedFixture from "../fixtures/agentscope/failed-repeated-tool.json";
import forkedFixture from "../fixtures/agentscope/forked-successful-code-audit.json";
import successfulFixture from "../fixtures/agentscope/successful-code-audit.json";
import { projectTraceEvents } from "../lib/agentscope/domain";
import { compareRuns } from "../lib/agentscope/compare/compare-runs";
import { evaluateRun, evalReportToMarkdown } from "../lib/agentscope/eval/evaluate-run";

describe("AgentScope run comparison", () => {
  it("aligns behavior and reports factual parent-child deltas", () => {
    const parent = projectTraceEvents(failedFixture.events);
    const child = projectTraceEvents(forkedFixture.events);
    const comparison = compareRuns(parent, child);

    expect(comparison.sameTaskInput).toBe(true);
    expect(comparison.parentFacts.errorCount).toBe(4);
    expect(comparison.childFacts.errorCount).toBe(0);
    expect(comparison.parentFacts.duplicateToolCalls).toBe(2);
    expect(comparison.path.some((item) => item.status === "removed")).toBe(true);
    expect(comparison.summary).toContain("Errors changed by -4.");
  });
});

describe("AgentScope deterministic eval", () => {
  it("separates measured facts, rule scores, evidence and limitations", () => {
    const projection = projectTraceEvents(failedFixture.events);
    const report = evaluateRun(projection);
    const markdown = evalReportToMarkdown(report);

    expect(report.verdict).toBe("fail");
    expect(report.measuredFacts).toMatchObject({
      status: "error",
      errorCount: 4,
      toolCalls: 3,
      duplicateToolCalls: 2,
    });
    expect(report.scores.every((score) => score.basis === "deterministic_rule")).toBe(true);
    expect(report.scores.find((score) => score.id === "loop_efficiency")?.evidenceSpanIds)
      .toHaveLength(2);
    expect(markdown).toContain("## Measured facts");
    expect(markdown).toContain("## Deterministic rule scores");
  });

  it("does not invent token metrics when the provider omitted them", () => {
    const report = evaluateRun(projectTraceEvents(successfulFixture.events));
    expect(report.measuredFacts.totalTokens).toBe(280);

    const withoutTokens = {
      ...projectTraceEvents(successfulFixture.events),
      spans: projectTraceEvents(successfulFixture.events).spans.map((span) => ({
        ...span,
        metrics: span.metrics ? { ...span.metrics, tokenUsage: undefined } : undefined,
      })),
    };
    const limited = evaluateRun(withoutTokens);
    expect(limited.measuredFacts.totalTokens).toBeUndefined();
    expect(limited.limitations).toContain("The provider did not report token usage.");
  });
});
