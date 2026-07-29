import { z } from "zod";
import { runStatusSchema } from "../domain";
import type { RunProjection } from "../domain/projection";
import { diagnoseRun } from "../diagnostics/diagnose-run";
import { summarizeTokens } from "../presentation/trace-view";

export const evalScoreSchema = z
  .object({
    id: z.enum([
      "task_completion",
      "tool_reliability",
      "loop_efficiency",
      "trace_integrity",
      "test_verification",
      "change_scope",
      "replay_safety",
    ]),
    label: z.string().min(1),
    score: z.number().int().min(0).max(100),
    basis: z.literal("deterministic_rule"),
    explanation: z.string().min(1),
    evidenceSpanIds: z.array(z.string().min(1)),
  })
  .strict();

export const runEvalReportSchema = z
  .object({
    reportSchemaVersion: z.literal(1),
    inputTraceSequence: z.number().int().positive(),
    runId: z.string().min(1),
    evaluator: z.literal("agentscope-deterministic-v1"),
    verdict: z.enum(["pass", "warning", "fail"]),
    overallScore: z.number().int().min(0).max(100),
    measuredFacts: z
      .object({
        status: runStatusSchema,
        spanCount: z.number().int().nonnegative(),
        errorCount: z.number().int().nonnegative(),
        toolCalls: z.number().int().nonnegative(),
        successfulToolCalls: z.number().int().nonnegative(),
        duplicateToolCalls: z.number().int().nonnegative(),
        durationMs: z.number().int().nonnegative(),
        totalTokens: z.number().int().nonnegative().optional(),
        codeFix: z
          .object({
            testPassed: z.boolean(),
            patchCreated: z.boolean(),
            outOfScopeModification: z.boolean(),
            replaySafetyViolations: z.number().int().nonnegative(),
            noProgressCalls: z.number().int().nonnegative(),
          })
          .strict()
          .optional(),
      })
      .strict(),
    scores: z.array(evalScoreSchema),
    limitations: z.array(z.string().min(1)),
  })
  .strict();

export type EvalScore = z.infer<typeof evalScoreSchema>;
export type RunEvalReport = z.infer<typeof runEvalReportSchema>;

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
  const isCodeFix = projection.run.taskType === "code_fix";
  const testSpans = toolSpans.filter((span) => span.name === "run_tests");
  const passedTest = testSpans.find((span) => span.status === "success");
  const patchSpans = toolSpans.filter((span) => span.name === "apply_patch");
  const policyViolations = toolSpans.filter(
    (span) =>
      span.status === "error" &&
      ["WORKSPACE_PATH_BLOCKED", "PATCH_PATH_BLOCKED"].includes(
        span.error?.code ?? "",
      ),
  );
  const noProgressEvidence = diagnostics
    .filter((item) => item.ruleId === "no-progress-loop")
    .flatMap((item) => item.evidenceSpanIds);
  if (isCodeFix) {
    scores.push(
      {
        id: "test_verification",
        label: "Test verification",
        score: passedTest ? 100 : 0,
        basis: "deterministic_rule",
        explanation: passedTest
          ? "The fixed scenario test command completed successfully."
          : "No successful target test execution was captured.",
        evidenceSpanIds: passedTest
          ? [passedTest.id]
          : testSpans.map((span) => span.id),
      },
      {
        id: "change_scope",
        label: "Change scope",
        score: policyViolations.length === 0 && patchSpans.length > 0 ? 100 : 0,
        basis: "deterministic_rule",
        explanation:
          policyViolations.length === 0
            ? `${patchSpans.length} patch calls remained inside the scenario allowlist.`
            : `${policyViolations.length} out-of-scope workspace changes were blocked.`,
        evidenceSpanIds:
          policyViolations.length > 0
            ? policyViolations.map((span) => span.id)
            : patchSpans.map((span) => span.id),
      },
      {
        id: "replay_safety",
        label: "Replay safety",
        score: policyViolations.length === 0 ? 100 : 0,
        basis: "deterministic_rule",
        explanation:
          policyViolations.length === 0
            ? "No workspace or patch policy violations were captured."
            : "At least one sandbox policy violation was captured.",
        evidenceSpanIds: policyViolations.map((span) => span.id),
      },
    );
  }
  const overallScore = Math.round(
    scores.reduce((sum, score) => sum + score.score, 0) / scores.length,
  );
  const limitations = [
    "Scores evaluate captured execution behavior, not hidden model reasoning.",
  ];
  if (!hasTokens) limitations.push("The provider did not report token usage.");
  if (toolSpans.length === 0) limitations.push("No tool calls were captured, so tool scores are neutral.");

  return {
    reportSchemaVersion: 1,
    inputTraceSequence: projection.lastSequence,
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
      codeFix: isCodeFix
        ? {
            testPassed: Boolean(passedTest),
            patchCreated: patchSpans.length > 0,
            outOfScopeModification: policyViolations.length > 0,
            replaySafetyViolations: policyViolations.length,
            noProgressCalls: new Set(noProgressEvidence).size,
          }
        : undefined,
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
    `Report schema: v${report.reportSchemaVersion}`,
    `Input trace sequence: ${report.inputTraceSequence}`,
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
