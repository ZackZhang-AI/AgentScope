import successfulFixtureJson from "../../../fixtures/agentscope/successful-code-audit.json";
import failedFixtureJson from "../../../fixtures/agentscope/failed-repeated-tool.json";
import forkedFixtureJson from "../../../fixtures/agentscope/forked-successful-code-audit.json";
import { projectTraceEvents } from "../domain/projection";
import { traceFixtureSchema, type TraceEvent } from "../domain/event";
import { evaluateRun, evalReportToMarkdown } from "../eval/evaluate-run";
import type { AuditResponse, Finding } from "../../types";

export type DemoRun = {
  slug: "successful-code-audit" | "failed-repeated-tool" | "forked-successful-code-audit";
  label: string;
  description: string;
  replayMode: "fixture";
  events: TraceEvent[];
  result: AuditResponse;
};

function buildDemoRun(
  input: unknown,
  slug: DemoRun["slug"],
  label: string,
): DemoRun {
  const fixture = traceFixtureSchema.parse(input);
  const trace = projectTraceEvents(fixture.events);
  const evaluation = evaluateRun(trace);
  const failed = trace.run.status === "error";
  const findings: Finding[] = failed
    ? [{
        severity: "high",
        title: "Repeated tool failure exhausted retries",
        evidence: "The same read-only tool input failed three times without observable progress.",
        recommendation: "Correct the repository path before retrying from the captured checkpoint.",
        category: "reliability",
      }]
    : [];
  const startedAt = trace.run.startedAt ?? trace.run.createdAt;
  const completedAt = trace.run.completedAt ?? startedAt;
  const modelTokens = evaluation.measuredFacts.totalTokens;
  const score = evaluation.overallScore;

  return {
    slug,
    label,
    description: fixture.description,
    replayMode: "fixture",
    events: fixture.events,
    result: {
      id: trace.run.id,
      createdAt: trace.run.createdAt,
      provider: "mock",
      model: trace.run.configSnapshot.model,
      summary: fixture.description,
      riskScore: failed ? 95 : trace.run.parentRunId ? 10 : 20,
      inputMeta: {
        inputType: "files",
        intensity: "standard",
        rules: ["security", "reliability", "testing", "maintainability"],
        contentHash: trace.run.taskInputHash.slice(0, 16),
        estimatedLines: 12,
        source: { kind: "pasted" },
      },
      metrics: {
        startedAt,
        completedAt,
        durationMs: evaluation.measuredFacts.durationMs,
        providerLatencyMs: trace.spans
          .filter((span) => span.kind === "model")
          .reduce((total, span) => total + (span.metrics?.durationMs ?? 0), 0),
        promptVersion: trace.run.configSnapshot.promptVersion,
        tokenUsage: modelTokens === undefined ? undefined : { totalTokens: modelTokens },
      },
      events: [{
        id: "report",
        stage: "report",
        status: failed ? "error" : "complete",
        title: failed ? "Fixture run failed" : "Fixture run completed",
        detail: fixture.description,
        timestamp: completedAt,
        durationMs: evaluation.measuredFacts.durationMs,
      }],
      trace,
      findings,
      evalCard: {
        reproducibility: trace.checkpoints.length > 0 ? 100 : 70,
        traceability: 100,
        testability: score,
        confidence: 100,
        score,
      },
      reportMarkdown: evalReportToMarkdown(evaluation),
    },
  };
}

export const demoRunCatalog: DemoRun[] = [
  buildDemoRun(successfulFixtureJson, "successful-code-audit", "Successful audit"),
  buildDemoRun(failedFixtureJson, "failed-repeated-tool", "Repeated tool failure"),
  buildDemoRun(forkedFixtureJson, "forked-successful-code-audit", "Forked recovery"),
];

export function findDemoRun(runId: string) {
  return demoRunCatalog.find((demo) => demo.result.id === runId);
}
