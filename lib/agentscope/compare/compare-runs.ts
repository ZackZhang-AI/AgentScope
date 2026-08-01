import type { RunProjection } from "../domain/projection";
import type { Span } from "../domain/span";
import { diagnoseRun } from "../diagnostics/diagnose-run";
import { summarizeTokens } from "../presentation/trace-view";

export type AlignedSpan = {
  key: string;
  status: "unchanged" | "changed" | "added" | "removed";
  confidence: number;
  matchReason: "kind_name_occurrence" | "unmatched";
  parentSpan?: Span;
  childSpan?: Span;
  changes: string[];
};

export type RunFacts = {
  durationMs: number;
  spanCount: number;
  modelCalls: number;
  toolCalls: number;
  errorCount: number;
  duplicateToolCalls: number;
  totalTokens?: number;
};

export type RunComparison = {
  parentRunId: string;
  childRunId: string;
  sameTaskInput: boolean;
  configurationChanges: string[];
  alignmentConfidence: number;
  unmatchedSpanCount: number;
  finalOutputChanged: boolean;
  path: AlignedSpan[];
  parentFacts: RunFacts;
  childFacts: RunFacts;
  summary: string[];
  outcomes: {
    resolved: string[];
    regressed: string[];
    tradeOffs: string[];
  };
};

function runDuration(projection: RunProjection) {
  const start = projection.run.startedAt ?? projection.run.createdAt;
  const end = projection.run.completedAt ?? start;
  return Math.max(0, Date.parse(end) - Date.parse(start));
}

function duplicateCount(projection: RunProjection) {
  return diagnoseRun(projection)
    .filter((diagnostic) => diagnostic.ruleId === "duplicate-tool-call")
    .reduce((total, diagnostic) => total + Math.max(0, diagnostic.evidenceSpanIds.length - 1), 0);
}

function facts(projection: RunProjection): RunFacts {
  const tokenValues = projection.spans
    .filter((span) => span.kind === "model")
    .map(summarizeTokens);
  const hasTokens = tokenValues.some((value) => value > 0);

  return {
    durationMs: runDuration(projection),
    spanCount: projection.spans.length,
    modelCalls: projection.spans.filter((span) => span.kind === "model").length,
    toolCalls: projection.spans.filter((span) => span.kind === "tool").length,
    errorCount: projection.spans.filter((span) => span.status === "error").length,
    duplicateToolCalls: duplicateCount(projection),
    totalTokens: hasTokens ? tokenValues.reduce((sum, value) => sum + value, 0) : undefined,
  };
}

function indexedSpans(spans: Span[]) {
  const counts = new Map<string, number>();
  return new Map(
    [...spans]
      .sort((left, right) => left.sequence - right.sequence)
      .map((span) => {
        const base = `${span.kind}:${span.name}`;
        const occurrence = (counts.get(base) ?? 0) + 1;
        counts.set(base, occurrence);
        return [`${base}:${occurrence}`, span] as const;
      }),
  );
}

function compareSpan(parentSpan: Span, childSpan: Span) {
  const changes: string[] = [];
  if (parentSpan.status !== childSpan.status) {
    changes.push(`status: ${parentSpan.status} -> ${childSpan.status}`);
  }
  if (JSON.stringify(parentSpan.inputRef) !== JSON.stringify(childSpan.inputRef)) {
    changes.push("input changed");
  }
  if (JSON.stringify(parentSpan.outputRef) !== JSON.stringify(childSpan.outputRef)) {
    changes.push("output changed");
  }
  if (parentSpan.error?.type !== childSpan.error?.type || parentSpan.error?.code !== childSpan.error?.code) {
    changes.push("error changed");
  }
  if (parentSpan.metrics?.durationMs !== childSpan.metrics?.durationMs) {
    changes.push("duration changed");
  }
  if (summarizeTokens(parentSpan) !== summarizeTokens(childSpan)) {
    changes.push("token usage changed");
  }
  return changes;
}

function configurationChanges(parent: RunProjection, child: RunProjection) {
  const changes: string[] = [];
  const left = parent.run.configSnapshot;
  const right = child.run.configSnapshot;
  if (left.provider !== right.provider) changes.push(`provider: ${left.provider} -> ${right.provider}`);
  if (left.model !== right.model) changes.push(`model: ${left.model ?? "n/a"} -> ${right.model ?? "n/a"}`);
  if (left.promptVersion !== right.promptVersion) {
    changes.push(`prompt: ${left.promptVersion} -> ${right.promptVersion}`);
  }
  if (JSON.stringify(left.modelParameters) !== JSON.stringify(right.modelParameters)) {
    changes.push("model parameters changed");
  }
  if (parent.run.environmentFingerprint.fingerprint !== child.run.environmentFingerprint.fingerprint) {
    changes.push("environment fingerprint changed");
  }
  return changes;
}

export function compareRuns(
  parent: RunProjection,
  child: RunProjection,
): RunComparison {
  const parentSpans = indexedSpans(parent.spans);
  const childSpans = indexedSpans(child.spans);
  const keys = [...new Set([...parentSpans.keys(), ...childSpans.keys()])];
  const path: AlignedSpan[] = keys.map((key) => {
    const parentSpan = parentSpans.get(key);
    const childSpan = childSpans.get(key);
    if (!parentSpan) {
      return {
        key,
        status: "added",
        confidence: 0,
        matchReason: "unmatched",
        childSpan,
        changes: ["step added"],
      };
    }
    if (!childSpan) {
      return {
        key,
        status: "removed",
        confidence: 0,
        matchReason: "unmatched",
        parentSpan,
        changes: ["step removed"],
      };
    }
    const changes = compareSpan(parentSpan, childSpan);
    return {
      key,
      status: changes.length > 0 ? "changed" : "unchanged",
      confidence: 1,
      matchReason: "kind_name_occurrence",
      parentSpan,
      childSpan,
      changes,
    };
  });

  const parentFacts = facts(parent);
  const childFacts = facts(child);
  const matched = path.filter((item) => item.matchReason !== "unmatched");
  const unmatchedSpanCount = path.length - matched.length;
  const alignmentConfidence = path.length === 0
    ? 1
    : matched.reduce((sum, item) => sum + item.confidence, 0) / path.length;
  const parentFinalOutput = [...parent.spans]
    .sort((left, right) => right.sequence - left.sequence)
    .find((span) => span.outputRef)?.outputRef;
  const childFinalOutput = [...child.spans]
    .sort((left, right) => right.sequence - left.sequence)
    .find((span) => span.outputRef)?.outputRef;
  const finalOutputChanged =
    JSON.stringify(parentFinalOutput) !== JSON.stringify(childFinalOutput);
  const summary = [
    `Run status changed from ${parent.run.status} to ${child.run.status}.`,
    `Errors changed by ${childFacts.errorCount - parentFacts.errorCount}.`,
    `Duration changed by ${childFacts.durationMs - parentFacts.durationMs} ms.`,
    `Duplicate tool calls changed by ${childFacts.duplicateToolCalls - parentFacts.duplicateToolCalls}.`,
    `Final captured output ${finalOutputChanged ? "changed" : "did not change"}.`,
  ];
  if (parentFacts.totalTokens !== undefined && childFacts.totalTokens !== undefined) {
    summary.push(`Reported tokens changed by ${childFacts.totalTokens - parentFacts.totalTokens}.`);
  }
  const resolved: string[] = [];
  const regressed: string[] = [];
  const tradeOffs: string[] = [];
  if (parent.run.status === "error" && child.run.status === "success") {
    resolved.push("The child completed the task that failed in the parent.");
  }
  if (childFacts.errorCount < parentFacts.errorCount) {
    resolved.push(
      `${parentFacts.errorCount - childFacts.errorCount} captured errors were removed.`,
    );
  } else if (childFacts.errorCount > parentFacts.errorCount) {
    regressed.push(
      `${childFacts.errorCount - parentFacts.errorCount} new captured errors appeared.`,
    );
  }
  if (childFacts.duplicateToolCalls < parentFacts.duplicateToolCalls) {
    resolved.push("The no-progress duplicate tool loop was reduced.");
  } else if (childFacts.duplicateToolCalls > parentFacts.duplicateToolCalls) {
    regressed.push("The child introduced additional duplicate tool calls.");
  }
  if (childFacts.durationMs > parentFacts.durationMs) {
    tradeOffs.push(
      `The child used ${childFacts.durationMs - parentFacts.durationMs} ms more runtime.`,
    );
  }
  if (
    parentFacts.totalTokens !== undefined &&
    childFacts.totalTokens !== undefined &&
    childFacts.totalTokens > parentFacts.totalTokens
  ) {
    tradeOffs.push(
      `The child used ${childFacts.totalTokens - parentFacts.totalTokens} more reported tokens.`,
    );
  }

  return {
    parentRunId: parent.run.id,
    childRunId: child.run.id,
    sameTaskInput: parent.run.taskInputHash === child.run.taskInputHash,
    configurationChanges: configurationChanges(parent, child),
    alignmentConfidence,
    unmatchedSpanCount,
    finalOutputChanged,
    path,
    parentFacts,
    childFacts,
    summary,
    outcomes: { resolved, regressed, tradeOffs },
  };
}
