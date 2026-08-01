import { z } from "zod";
import type { RunProjection } from "../domain/projection";
import type { JsonValue } from "../domain/common";
import type { Span } from "../domain/span";
import { summarizeTokens } from "../presentation/trace-view";

export const diagnosticSchema = z
  .object({
    id: z.string().min(1),
    ruleId: z.string().min(1),
    ruleVersion: z.literal(1),
    severity: z.enum(["info", "warning", "error"]),
    category: z.enum([
      "error",
      "retry",
      "loop",
      "latency",
      "token",
      "data_quality",
    ]),
    title: z.string().min(1),
    explanation: z.string().min(1),
    evidenceSpanIds: z.array(z.string().min(1)),
    confidence: z.number().min(0).max(1),
  })
  .strict();

export type Diagnostic = z.infer<typeof diagnosticSchema>;

function normalizeJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(normalizeJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !["requestId", "timestamp", "traceId"].includes(key))
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, normalizeJson(child)]),
    );
  }
  return value;
}

function toolSignature(span: Span) {
  const input = span.inputRef?.kind === "inline"
    ? normalizeJson(span.inputRef.data)
    : span.inputRef;
  return JSON.stringify([span.name, input]);
}

function progressHash(span: Span) {
  if (span.outputRef?.kind !== "inline") return undefined;
  const data = span.outputRef.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return undefined;
  const value = data.progressHash;
  return typeof value === "string" ? value : undefined;
}

function duration(span: Span) {
  return span.metrics?.durationMs ?? (
    span.endedAt ? Math.max(0, Date.parse(span.endedAt) - Date.parse(span.startedAt)) : 0
  );
}

export function diagnoseRun(projection: RunProjection): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const orderedSpans = [...projection.spans].sort((left, right) => left.sequence - right.sequence);
  const errors = orderedSpans
    .filter((span) => span.status === "error")
    .sort((left, right) => {
      const leftEndedAt = left.endedAt ? Date.parse(left.endedAt) : Number.MAX_SAFE_INTEGER;
      const rightEndedAt = right.endedAt ? Date.parse(right.endedAt) : Number.MAX_SAFE_INTEGER;
      return leftEndedAt - rightEndedAt || left.sequence - right.sequence;
    });

  if (errors.length > 0) {
    const first = errors[0];
    diagnostics.push({
      id: `diag_error_${first.id}`,
      ruleId: "first-unrecovered-error",
      ruleVersion: 1,
      severity: "error",
      category: "error",
      title: "Possible failure starting point",
      explanation: `${first.name} is the earliest captured error. ${first.error?.message ?? "No structured error message was recorded."}`,
      evidenceSpanIds: errors.map((span) => span.id),
      confidence: 0.86,
    });
  }

  const duplicateGroups = new Map<string, Span[]>();
  for (const span of orderedSpans) {
    if (span.kind !== "tool") continue;
    const signature = toolSignature(span);
    const group = duplicateGroups.get(signature) ?? [];
    group.push(span);
    duplicateGroups.set(signature, group);
  }

  for (const group of duplicateGroups.values()) {
    if (group.length < 2) continue;
    const first = group[0];
    diagnostics.push({
      id: `diag_duplicate_${first.id}`,
      ruleId: "duplicate-tool-call",
      ruleVersion: 1,
      severity: group.length >= 3 ? "error" : "warning",
      category: group.length >= 3 ? "loop" : "retry",
      title: `${group.length} duplicate tool calls`,
      explanation: `${first.name} received the same normalized input ${group.length} times. Volatile request metadata is ignored.`,
      evidenceSpanIds: group.map((span) => span.id),
      confidence: 0.98,
    });

    const hashes = group.map(progressHash);
    if (
      group.length >= 3 &&
      hashes.every((hash): hash is string => Boolean(hash)) &&
      new Set(hashes).size === 1
    ) {
      diagnostics.push({
        id: `diag_no_progress_${first.id}`,
        ruleId: "no-progress-loop",
        ruleVersion: 1,
        severity: "error",
        category: "loop",
        title: "No-progress tool loop",
        explanation: `${first.name} repeated ${group.length} times while the workspace and result hashes remained unchanged.`,
        evidenceSpanIds: group.map((span) => span.id),
        confidence: 1,
      });
    }
  }

  const timed = orderedSpans.filter(
    (span) => (span.kind === "model" || span.kind === "tool") && duration(span) > 0,
  );
  const slowest = timed.reduce<Span | undefined>(
    (current, span) => !current || duration(span) > duration(current) ? span : current,
    undefined,
  );
  if (slowest) {
    diagnostics.push({
      id: `diag_latency_${slowest.id}`,
      ruleId: "latency-hotspot",
      ruleVersion: 1,
      severity: "info",
      category: "latency",
      title: "Latency hotspot",
      explanation: `${slowest.name} is the slowest model or tool span at ${duration(slowest)} ms.`,
      evidenceSpanIds: [slowest.id],
      confidence: 1,
    });
  }

  const tokenSpans = orderedSpans.filter((span) => span.kind === "model" && summarizeTokens(span) > 0);
  const tokenHotspot = tokenSpans.reduce<Span | undefined>(
    (current, span) => !current || summarizeTokens(span) > summarizeTokens(current) ? span : current,
    undefined,
  );
  if (tokenHotspot) {
    diagnostics.push({
      id: `diag_token_${tokenHotspot.id}`,
      ruleId: "token-hotspot",
      ruleVersion: 1,
      severity: "info",
      category: "token",
      title: "Token hotspot",
      explanation: `${tokenHotspot.name} used ${summarizeTokens(tokenHotspot)} reported tokens.`,
      evidenceSpanIds: [tokenHotspot.id],
      confidence: 1,
    });
  }

  for (const [index, issue] of projection.dataQualityIssues.entries()) {
    diagnostics.push({
      id: `diag_quality_${index}_${issue.spanId ?? "run"}`,
      ruleId: issue.code,
      ruleVersion: 1,
      severity: "warning",
      category: "data_quality",
      title: "Trace data quality issue",
      explanation: issue.message,
      evidenceSpanIds: issue.spanId ? [issue.spanId] : [],
      confidence: 1,
    });
  }

  return diagnostics;
}
