import type { RunProjection } from "../domain/projection";
import { diagnoseRun } from "../diagnostics/diagnose-run";
import { summarizeTokens } from "../presentation/trace-view";

export type EvalScore = {
  id: "task_completion" | "tool_reliability" | "loop_efficiency" | "trace_integrity";
  label: string;
  score: number;
  basis: "deterministic_rule";
  explanation: string;
  evidenceSpanIds: string[];
};

export type RunEvalReport = {
  runId: string;
  evaluator: "agentscope-deterministic-v1";
  verdict: "pass" | "warning" | "fail";
  overallScore: number;
  measuredFacts: {
    status: RunProjection["run"]["status"];
    spanCount: number;
    errorCount: number;
    toolCalls: number;
    successfulToolCalls: number;
    duplicateToolCalls: number;
    durationMs: number;
    totalTokens?: number;
  };
  scores: EvalScore[];
  limitations: string[];
};

function duration(projection: RunProjection) {
  const start = projection.run.startedAt ?? projection.run.createdAt;
  const end = projection.run.completedAt ?? start;
  return Math.max(0, Date.parse(end) - Date.parse(start));
}

export function evaluateRun(projection: RunProjection): RunEvalReport {
  const diagnostics = diagnoseRun(projection);
  const toolSpans = projection.spans.filter((span) => span.kind === "tool");
  const successfulTools = toolSpans.filter((span) => span.status === "success");
  const duplicateEvidence = diagnostics
    .filter((item) => item.ruleId === "duplicate-tool-call")
    .flatMap((item) => item.evidenceSpanIds.slice(1));
  const duplicateToolCalls = new Set(duplicateEvidence).size;
  const errorSpans = projection.spans.filter((span) => span.status === "error");
  const tokenValues = projection.spans
    .filter((span) => span.kind === "model")
    .map(summarizeTokens);
  const hasTokens = tokenValues.some((value) => value > 0);
  const taskScore = projection.run.status === "success"
    ? 100
    : projection.run.status === "success_with_warnings"
      ? 75
      : 0;
  const toolScore = toolSpans.length > 0
    ? Math.round((successfulTools.length / toolSpans.length) * 100)
    : 100;
  const loopScore = toolSpans.length > 0
    ? Math.round(Math.max(0, 1 - duplicateToolCalls / toolSpans.length) * 100)
    : 100;
  const integrityScore = Math.max(0, 100 - projection.dataQualityIssues.length * 25);
  const scores: EvalScore[] = [
    {
      id: "task_completion",
      label: "Task completion",
      score: taskScore,
      basis: "deterministic_rule",
      explanation: `Mapped terminal run status ${projection.run.status} to the versioned completion rubric.`,
      evidenceSpanIds: errorSpans.map((span) => span.id),
    },
    {
      id: "tool_reliability",
      label: "Tool reliability",
      score: toolScore,
      basis: "deterministic_rule",
      explanation: `${successfulTools.length} of ${toolSpans.length} captured tool calls succeeded.`,
      evidenceSpanIds: toolSpans.filter((span) => span.status !== "success").map((span) => span.id),
    },
    {
      id: "loop_efficiency",
      label: "Loop efficiency",
      score: loopScore,
      basis: "deterministic_rule",
      explanation: `${duplicateToolCalls} of ${toolSpans.length} tool calls were attributable duplicates.`,
      evidenceSpanIds: duplicateEvidence,
    },
    {
      id: "trace_integrity",
      label: "Trace integrity",
      score: integrityScore,
      basis: "deterministic_rule",
      explanation: `${projection.dataQualityIssues.length} trace data quality issues were detected.`,
      evidenceSpanIds: projection.dataQualityIssues.flatMap((issue) => issue.spanId ? [issue.spanId] : []),
    },
  ];
  const overallScore = Math.round(
    scores.reduce((sum, score) => sum + score.score, 0) / scores.length,
  );
  const limitations = [
    "Scores evaluate captured execution behavior, not hidden model reasoning.",
  ];
  if (!hasTokens) limitations.push("The provider did not report token usage.");
  if (toolSpans.length === 0) limitations.push("No tool calls were captured, so tool scores are neutral.");

  return {
    runId: projection.run.id,
    evaluator: "agentscope-deterministic-v1",
    verdict: overallScore >= 85 ? "pass" : overallScore >= 60 ? "warning" : "fail",
    overallScore,
    measuredFacts: {
      status: projection.run.status,
      spanCount: projection.spans.length,
      errorCount: errorSpans.length,
      toolCalls: toolSpans.length,
      successfulToolCalls: successfulTools.length,
      duplicateToolCalls,
      durationMs: duration(projection),
      totalTokens: hasTokens ? tokenValues.reduce((sum, value) => sum + value, 0) : undefined,
    },
    scores,
    limitations,
  };
}

export function evalReportToMarkdown(report: RunEvalReport) {
  const facts = report.measuredFacts;
  return [
    `# AgentScope Eval Report`,
    "",
    `Run: ${report.runId}`,
    `Evaluator: ${report.evaluator}`,
    `Verdict: ${report.verdict}`,
    `Overall score: ${report.overallScore}/100`,
    "",
    "## Measured facts",
    "",
    `- Status: ${facts.status}`,
    `- Spans: ${facts.spanCount}`,
    `- Errors: ${facts.errorCount}`,
    `- Tool calls: ${facts.toolCalls}`,
    `- Successful tool calls: ${facts.successfulToolCalls}`,
    `- Duplicate tool calls: ${facts.duplicateToolCalls}`,
    `- Duration: ${facts.durationMs} ms`,
    `- Reported tokens: ${facts.totalTokens ?? "not available"}`,
    "",
    "## Deterministic rule scores",
    "",
    ...report.scores.flatMap((score) => [
      `### ${score.label}: ${score.score}/100`,
      "",
      score.explanation,
      `Evidence spans: ${score.evidenceSpanIds.join(", ") || "none"}`,
      "",
    ]),
    "## Limitations",
    "",
    ...report.limitations.map((limitation) => `- ${limitation}`),
  ].join("\n");
}
