import type { Span } from "../domain";

export type TraceRow = {
  span: Span;
  depth: number;
};

export type TimelineBar = {
  offsetPercent: number;
  widthPercent: number;
  durationMs: number;
};

export function flattenSpanTree(spans: readonly Span[]): TraceRow[] {
  const children = new Map<string | undefined, Span[]>();

  for (const span of spans) {
    const siblings = children.get(span.parentSpanId) ?? [];
    siblings.push(span);
    children.set(span.parentSpanId, siblings);
  }

  for (const siblings of children.values()) {
    siblings.sort((left, right) => left.sequence - right.sequence);
  }

  const rows: TraceRow[] = [];
  const visited = new Set<string>();

  function visit(span: Span, depth: number) {
    if (visited.has(span.id)) return;
    visited.add(span.id);
    rows.push({ span, depth });
    for (const child of children.get(span.id) ?? []) visit(child, depth + 1);
  }

  for (const root of children.get(undefined) ?? []) visit(root, 0);
  for (const span of spans) visit(span, 0);

  return rows;
}

export function getTraceBounds(spans: readonly Span[], now = Date.now()) {
  if (spans.length === 0) return { startMs: now, endMs: now + 1 };

  const startMs = Math.min(...spans.map((span) => Date.parse(span.startedAt)));
  const endMs = Math.max(
    ...spans.map((span) => span.endedAt ? Date.parse(span.endedAt) : now),
    startMs + 1,
  );

  return { startMs, endMs };
}

export function getTimelineBar(
  span: Span,
  bounds: { startMs: number; endMs: number },
  now = Date.now(),
): TimelineBar {
  const traceDuration = Math.max(bounds.endMs - bounds.startMs, 1);
  const startedAt = Date.parse(span.startedAt);
  const endedAt = span.endedAt ? Date.parse(span.endedAt) : now;
  const durationMs = Math.max(endedAt - startedAt, 0);

  return {
    offsetPercent: Math.max(
      0,
      Math.min(100, ((startedAt - bounds.startMs) / traceDuration) * 100),
    ),
    widthPercent: Math.max(
      0.8,
      Math.min(100, (durationMs / traceDuration) * 100),
    ),
    durationMs,
  };
}

export function formatDuration(durationMs?: number) {
  if (durationMs === undefined) return "Running";
  if (durationMs < 1_000) return `${durationMs} ms`;
  return `${(durationMs / 1_000).toFixed(durationMs < 10_000 ? 2 : 1)} s`;
}

export function summarizeTokens(span: Span) {
  const usage = span.metrics?.tokenUsage;
  return usage?.totalTokens ?? (
    (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0)
  );
}
