import type { RunProjection } from "../domain/projection";
import type { Span } from "../domain/span";
import { diagnoseRun } from "../diagnostics/diagnose-run";
import { summarizeTokens } from "../presentation/trace-view";

export type AlignedSpan = {
  key: string;
  status: "unchanged" | "changed" | "added" | "removed";
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
  path: AlignedSpan[];
  parentFacts: RunFacts;
  childFacts: RunFacts;
  summary: string[];
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
    if (!parentSpan) return { key, status: "added", childSpan, changes: ["step added"] };
    if (!childSpan) return { key, status: "removed", parentSpan, changes: ["step removed"] };
    const changes = compareSpan(parentSpan, childSpan);
    return {
      key,
      status: changes.length > 0 ? "changed" : "unchanged",
      parentSpan,
      childSpan,
      changes,
    };
  });

  const parentFacts = facts(parent);
  const childFacts = facts(child);
  const summary = [
    `Run status changed from ${parent.run.status} to ${child.run.status}.`,
    `Errors changed by ${childFacts.errorCount - parentFacts.errorCount}.`,
    `Duration changed by ${childFacts.durationMs - parentFacts.durationMs} ms.`,
    `Duplicate tool calls changed by ${childFacts.duplicateToolCalls - parentFacts.duplicateToolCalls}.`,
  ];
  if (parentFacts.totalTokens !== undefined && childFacts.totalTokens !== undefined) {
    summary.push(`Reported tokens changed by ${childFacts.totalTokens - parentFacts.totalTokens}.`);
  }

  return {
    parentRunId: parent.run.id,
    childRunId: child.run.id,
    sameTaskInput: parent.run.taskInputHash === child.run.taskInputHash,
    configurationChanges: configurationChanges(parent, child),
    path,
    parentFacts,
    childFacts,
    summary,
  };
}
