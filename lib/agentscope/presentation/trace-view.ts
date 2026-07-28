import type { Span, SpanKind, SpanStatus } from "../domain/span";

export type TraceRow = {
  span: Span;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  hasErrorDescendant: boolean;
};

export type TimelineBar = {
  offsetPercent: number;
  widthPercent: number;
  durationMs: number;
};

export type TraceFilter = {
  query?: string;
  kind?: SpanKind;
  status?: SpanStatus;
  keyStepsOnly?: boolean;
};

export function flattenSpanTree(
  spans: readonly Span[],
  options: {
    collapsedSpanIds?: ReadonlySet<string>;
    filter?: TraceFilter;
  } = {},
): TraceRow[] {
  const children = new Map<string | undefined, Span[]>();
  const byId = new Map(spans.map((span) => [span.id, span]));

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
  const collapsed = options.collapsedSpanIds ?? new Set<string>();
  const query = options.filter?.query?.trim().toLocaleLowerCase();
  const filterActive = Boolean(
    query || options.filter?.kind || options.filter?.status || options.filter?.keyStepsOnly,
  );
  const visibleIds = new Set<string>();

  if (filterActive) {
    for (const span of spans) {
      const matches =
        (!query || `${span.name} ${span.id}`.toLocaleLowerCase().includes(query)) &&
        (!options.filter?.kind || span.kind === options.filter.kind) &&
        (!options.filter?.status || span.status === options.filter.status) &&
        (!options.filter?.keyStepsOnly || (
          ["model", "tool", "handoff", "guardrail"].includes(span.kind) ||
          span.status === "error"
        ));
      if (!matches) continue;

      let current: Span | undefined = span;
      while (current && !visibleIds.has(current.id)) {
        visibleIds.add(current.id);
        current = current.parentSpanId ? byId.get(current.parentSpanId) : undefined;
      }
    }
  }

  const errorMemo = new Map<string, boolean>();
  function hasError(span: Span): boolean {
    const cached = errorMemo.get(span.id);
    if (cached !== undefined) return cached;
    const result = span.status === "error" || (children.get(span.id) ?? []).some(hasError);
    errorMemo.set(span.id, result);
    return result;
  }

  function visit(span: Span, depth: number) {
    if (visited.has(span.id)) return;
    visited.add(span.id);
    if (filterActive && !visibleIds.has(span.id)) return;
    const childSpans = children.get(span.id) ?? [];
    const isExpanded = filterActive || !collapsed.has(span.id);
    rows.push({
      span,
      depth,
      hasChildren: childSpans.length > 0,
      isExpanded,
      hasErrorDescendant: childSpans.some(hasError),
    });
    if (isExpanded) {
      for (const child of childSpans) visit(child, depth + 1);
    } else {
      const markHidden = (hidden: Span) => {
        if (visited.has(hidden.id)) return;
        visited.add(hidden.id);
        for (const child of children.get(hidden.id) ?? []) markHidden(child);
      };
      for (const child of childSpans) markHidden(child);
    }
  }

  for (const root of children.get(undefined) ?? []) visit(root, 0);
  for (const span of spans) visit(span, 0);

  return rows;
}

export function getTimelineViewportBar(
  bar: TimelineBar,
  zoom: number,
  viewportStartPercent: number,
) {
  const viewportWidth = 100 / Math.max(1, zoom);
  const viewportEnd = viewportStartPercent + viewportWidth;
  const barStart = Math.max(bar.offsetPercent, viewportStartPercent);
  const barEnd = Math.min(bar.offsetPercent + bar.widthPercent, viewportEnd);

  if (barEnd <= barStart) return null;
  return {
    ...bar,
    offsetPercent: ((barStart - viewportStartPercent) / viewportWidth) * 100,
    widthPercent: Math.max(0.8, ((barEnd - barStart) / viewportWidth) * 100),
  };
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
