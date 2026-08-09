import type { Span } from "@/lib/agentscope/domain";
import type { RecordedCodeFixDemo } from "@/lib/agentscope/execution";

function progressHash(span: Span) {
  if (span.outputRef?.kind !== "inline") return undefined;
  const data = span.outputRef.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return undefined;
  return typeof data.progressHash === "string" ? data.progressHash : undefined;
}

export function buildDemoEvidenceViewModel(demo: RecordedCodeFixDemo) {
  const parent = demo.parent.result.trace;
  const child = demo.child.result.trace;
  const firstFailure = demo.diagnostics.find(
    (diagnostic) => diagnostic.ruleId === "first-unrecovered-error",
  );
  const noProgress = demo.diagnostics.find(
    (diagnostic) => diagnostic.ruleId === "no-progress-loop",
  );
  const repeatedSpans = (noProgress?.evidenceSpanIds ?? [])
    .map((spanId) => parent.spans.find((span) => span.id === spanId))
    .filter((span): span is Span => Boolean(span));
  const firstFailureSpan = parent.spans.find(
    (span) => span.id === firstFailure?.evidenceSpanIds[0],
  );
  const forkSpanId = child.run.forkedFromSpanId ?? repeatedSpans[0]?.id;
  const checkpoint = parent.checkpoints.find(
    (candidate) => candidate.spanId === forkSpanId,
  );
  const parentTools = parent.spans.filter((span) => span.kind === "tool");
  const actionPath = ["read_file", "search_code", "apply_patch", "run_tests"]
    .map((name) => parentTools.find((span) => span.name === name))
    .filter((span): span is Span => Boolean(span));
  const sharedProgressHash = repeatedSpans.map(progressHash).find(Boolean);

  return {
    actionPath,
    checkpoint,
    child,
    childEval: demo.childEval,
    comparison: demo.comparison,
    firstFailureSpan,
    forkSpanId,
    noProgress,
    parent,
    parentEval: demo.parentEval,
    repeatedSpans,
    sharedProgressHash,
  };
}

export type DemoEvidenceViewModel = ReturnType<typeof buildDemoEvidenceViewModel>;
