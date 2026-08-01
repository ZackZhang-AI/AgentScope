import {
  schemaVersion,
  traceEventSchema,
  type RunProjection,
  type Span,
  type TraceEvent,
} from "../domain";
import type { TraceRepository } from "./trace-repository";

function spanDepth(span: Span, spansById: ReadonlyMap<string, Span>) {
  let depth = 0;
  let current = span;
  const visited = new Set<string>();

  while (current.parentSpanId && !visited.has(current.parentSpanId)) {
    visited.add(current.parentSpanId);
    const parent = spansById.get(current.parentSpanId);
    if (!parent) break;
    depth += 1;
    current = parent;
  }

  return depth;
}

export function buildInterruptedRecoveryEvents(
  projection: RunProjection,
  recoveredAt: string,
): TraceEvent[] {
  if (projection.run.status !== "running") return [];

  const spansById = new Map(projection.spans.map((span) => [span.id, span]));
  const runningSpans = projection.spans
    .filter((span) => span.status === "running")
    .sort(
      (left, right) =>
        spanDepth(right, spansById) - spanDepth(left, spansById) ||
        right.sequence - left.sequence,
    );
  let sequence = projection.lastSequence;

  const spanEvents = runningSpans.map((span) =>
    traceEventSchema.parse({
      eventId: `recovery:${projection.run.id}:${sequence + 1}`,
      runId: projection.run.id,
      sequence: ++sequence,
      occurredAt: recoveredAt,
      receivedAt: recoveredAt,
      schemaVersion,
      type: "span.ended",
      spanId: span.id,
      payload: {
        status: "error",
        endedAt: recoveredAt,
        error: {
          type: "runner_interrupted",
          code: "AGENTSCOPE_RUNNER_INTERRUPTED",
          message: "The runner stopped before this span reached a terminal state.",
          retryable: true,
        },
        replayability: {
          level: "blocked",
          reason: "The interrupted process did not capture a complete checkpoint.",
        },
      },
    }),
  );

  return [
    ...spanEvents,
    traceEventSchema.parse({
      eventId: `recovery:${projection.run.id}:${sequence + 1}`,
      runId: projection.run.id,
      sequence: sequence + 1,
      occurredAt: recoveredAt,
      receivedAt: recoveredAt,
      schemaVersion,
      type: "run.ended",
      payload: {
        status: "error",
        completedAt: recoveredAt,
      },
    }),
  ];
}

export type InterruptedRecoveryResult = {
  candidates: number;
  recoveredRunIds: string[];
  failedRunIds: string[];
};

export async function recoverInterruptedRuns(
  repository: TraceRepository,
  options: {
    staleBefore: string;
    recoveredAt?: string;
    limit?: number;
  },
): Promise<InterruptedRecoveryResult> {
  const runIds = await repository.listStaleRunningRunIds(
    options.staleBefore,
    options.limit,
  );
  const recoveredRunIds: string[] = [];
  const failedRunIds: string[] = [];
  const recoveredAt = options.recoveredAt ?? new Date().toISOString();

  for (const runId of runIds) {
    try {
      const projection = await repository.getProjection(runId);
      if (!projection || projection.run.status !== "running") continue;
      const events = buildInterruptedRecoveryEvents(projection, recoveredAt);
      if (events.length === 0) continue;
      await repository.appendMany(events);
      recoveredRunIds.push(runId);
    } catch {
      failedRunIds.push(runId);
    }
  }

  return {
    candidates: runIds.length,
    recoveredRunIds,
    failedRunIds,
  };
}
