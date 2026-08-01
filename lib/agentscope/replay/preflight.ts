import type { RunProjection } from "../domain/projection";
import type { Span } from "../domain/span";
import type { ToolSideEffect } from "../domain/checkpoint";

export type ReplayAction = {
  spanId: string;
  name: string;
  kind: Span["kind"];
  policy: "execute" | "fixed_response" | "blocked";
  reason: string;
};

export type ReplayPreflight = {
  parentRunId: string;
  targetSpanId: string;
  checkpointId?: string;
  status: "ready" | "review_required" | "blocked";
  reasons: string[];
  actions: ReplayAction[];
};

const sideEffects = new Set<ToolSideEffect>([
  "read_only",
  "idempotent",
  "side_effect",
  "destructive",
  "unknown",
]);

function getSideEffect(span: Span): ToolSideEffect {
  const value = span.attributes["tool.side_effect"];
  return typeof value === "string" && sideEffects.has(value as ToolSideEffect)
    ? value as ToolSideEffect
    : "unknown";
}

function actionForSpan(span: Span): ReplayAction {
  if (span.kind !== "tool") {
    return {
      spanId: span.id,
      name: span.name,
      kind: span.kind,
      policy: "execute",
      reason: "Agent and model steps execute with the selected branch configuration.",
    };
  }

  const sideEffect = getSideEffect(span);
  if (sideEffect === "read_only" || sideEffect === "idempotent") {
    return {
      spanId: span.id,
      name: span.name,
      kind: span.kind,
      policy: "execute",
      reason: `Tool policy is ${sideEffect}.`,
    };
  }

  if (span.outputRef) {
    return {
      spanId: span.id,
      name: span.name,
      kind: span.kind,
      policy: "fixed_response",
      reason: `Tool policy is ${sideEffect}; the captured output will be reused.`,
    };
  }

  return {
    spanId: span.id,
    name: span.name,
    kind: span.kind,
    policy: "blocked",
    reason: `Tool policy is ${sideEffect} and no captured output is available.`,
  };
}

export function buildReplayPreflight(
  projection: RunProjection,
  targetSpanId: string,
): ReplayPreflight {
  const target = projection.spans.find((span) => span.id === targetSpanId);
  if (!target) {
    return {
      parentRunId: projection.run.id,
      targetSpanId,
      status: "blocked",
      reasons: ["The target span does not exist in the parent run."],
      actions: [],
    };
  }

  const checkpoint = projection.checkpoints.find(
    (item) => item.spanId === target.id || item.id === target.replayability?.checkpointId,
  );
  const reasons: string[] = [];

  if (!checkpoint) reasons.push("No replay checkpoint was captured for this step.");
  if (checkpoint?.completeness !== "complete") {
    reasons.push(...(checkpoint?.blockedReasons ?? ["The replay checkpoint is incomplete."]));
  }
  if (target.replayability?.level === "blocked") {
    reasons.push(target.replayability.reason);
  }

  const actions = projection.spans
    .filter((span) => span.sequence >= target.sequence && span.id !== projection.run.rootSpanId)
    .sort((left, right) => left.sequence - right.sequence)
    .map(actionForSpan);
  const blockedActions = actions.filter((action) => action.policy === "blocked");
  if (blockedActions.length > 0) {
    reasons.push(`${blockedActions.length} downstream action cannot be safely replayed.`);
  }

  return {
    parentRunId: projection.run.id,
    targetSpanId,
    checkpointId: checkpoint?.id,
    status: reasons.length > 0
      ? "blocked"
      : actions.some((action) => action.policy === "fixed_response")
        ? "review_required"
        : "ready",
    reasons,
    actions,
  };
}
