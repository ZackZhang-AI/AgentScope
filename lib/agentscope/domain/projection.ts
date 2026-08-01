import { z } from "zod";
import type { Artifact } from "./artifact";
import { artifactSchema } from "./artifact";
import type { ReplayCheckpoint } from "./checkpoint";
import { replayCheckpointSchema } from "./checkpoint";
import { traceEventSchema, type TraceEvent } from "./event";
import { assertRunTransition, runSchema, type Run } from "./run";
import {
  assertSpanTransition,
  spanSchema,
  type Span,
} from "./span";

export type TraceDataQualityIssue = {
  code: "clock_skew" | "unclosed_span";
  message: string;
  spanId?: string;
};

export type RunProjection = {
  run: Run;
  spans: Span[];
  artifacts: Artifact[];
  checkpoints: ReplayCheckpoint[];
  lastSequence: number;
  dataQualityIssues: TraceDataQualityIssue[];
};

export const traceDataQualityIssueSchema = z
  .object({
    code: z.enum(["clock_skew", "unclosed_span"]),
    message: z.string().min(1),
    spanId: z.string().min(1).optional(),
  })
  .strict();

export const runProjectionSchema = z
  .object({
    run: runSchema,
    spans: z.array(spanSchema),
    artifacts: z.array(artifactSchema),
    checkpoints: z.array(replayCheckpointSchema),
    lastSequence: z.number().int().positive(),
    dataQualityIssues: z.array(traceDataQualityIssueSchema),
  })
  .strict();

export class TraceProjectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TraceProjectionError";
  }
}

function assertEventIdentity(
  event: TraceEvent,
  runId: string,
  seenEventIds: Set<string>,
  lastSequence: number,
) {
  if (event.runId !== runId) {
    throw new TraceProjectionError(
      `Event ${event.eventId} belongs to a different run.`,
    );
  }

  if (seenEventIds.has(event.eventId)) {
    throw new TraceProjectionError(`Duplicate eventId: ${event.eventId}.`);
  }

  if (event.sequence <= lastSequence) {
    throw new TraceProjectionError(
      `Event sequence must increase: ${event.sequence} followed ${lastSequence}.`,
    );
  }
}

export function projectTraceEvents(input: readonly unknown[]): RunProjection {
  const events = input.map((event) => traceEventSchema.parse(event));
  const first = events[0];

  if (!first || first.type !== "run.created") {
    throw new TraceProjectionError("The first event must be run.created.");
  }

  let run = runSchema.parse(first.payload.run);
  if (run.id !== first.runId) {
    throw new TraceProjectionError("run.created does not match event runId.");
  }

  const spans = new Map<string, Span>();
  const artifacts: Artifact[] = [];
  const checkpoints: ReplayCheckpoint[] = [];
  const issues: TraceDataQualityIssue[] = [];
  const seenEventIds = new Set<string>();
  let lastSequence = 0;

  for (const event of events) {
    assertEventIdentity(event, run.id, seenEventIds, lastSequence);
    seenEventIds.add(event.eventId);
    lastSequence = event.sequence;

    if (Date.parse(event.receivedAt) < Date.parse(event.occurredAt)) {
      issues.push({
        code: "clock_skew",
        message: `Event ${event.eventId} was received before it occurred.`,
        spanId: "spanId" in event ? event.spanId : undefined,
      });
    }

    switch (event.type) {
      case "run.created":
        if (event.eventId !== first.eventId) {
          throw new TraceProjectionError("A run can only be created once.");
        }
        break;

      case "run.started":
        assertRunTransition(run.status, "running");
        run = runSchema.parse({
          ...run,
          status: "running",
          startedAt: event.payload.startedAt,
        });
        break;

      case "span.started": {
        if (run.status !== "running") {
          throw new TraceProjectionError(
            `Cannot start span ${event.spanId} while run is ${run.status}.`,
          );
        }
        if (event.payload.span.id !== event.spanId) {
          throw new TraceProjectionError(
            `span.started payload does not match ${event.spanId}.`,
          );
        }
        if (event.payload.span.runId !== run.id) {
          throw new TraceProjectionError(
            `Span ${event.spanId} belongs to a different run.`,
          );
        }
        if (spans.has(event.spanId)) {
          throw new TraceProjectionError(
            `Span ${event.spanId} has already started.`,
          );
        }
        if (
          event.payload.span.parentSpanId &&
          !spans.has(event.payload.span.parentSpanId)
        ) {
          throw new TraceProjectionError(
            `Parent span ${event.payload.span.parentSpanId} has not started.`,
          );
        }
        if (!event.payload.span.parentSpanId) {
          if (run.rootSpanId && run.rootSpanId !== event.spanId) {
            throw new TraceProjectionError("A run can only have one root span.");
          }
          run = runSchema.parse({ ...run, rootSpanId: event.spanId });
        }
        spans.set(event.spanId, event.payload.span);
        break;
      }

      case "span.ended": {
        const span = spans.get(event.spanId);
        if (!span) {
          throw new TraceProjectionError(
            `Cannot end unknown span ${event.spanId}.`,
          );
        }
        assertSpanTransition(span.status, event.payload.status);
        spans.set(
          event.spanId,
          spanSchema.parse({
            ...span,
            ...event.payload,
          }),
        );
        break;
      }

      case "artifact.created":
        if (event.payload.artifact.runId !== run.id) {
          throw new TraceProjectionError(
            `Artifact ${event.payload.artifact.id} belongs to a different run.`,
          );
        }
        if (event.spanId && !spans.has(event.spanId)) {
          throw new TraceProjectionError(
            `Artifact references unknown span ${event.spanId}.`,
          );
        }
        artifacts.push(event.payload.artifact);
        break;

      case "checkpoint.created":
        if (!spans.has(event.spanId)) {
          throw new TraceProjectionError(
            `Checkpoint references unknown span ${event.spanId}.`,
          );
        }
        if (
          event.payload.checkpoint.runId !== run.id ||
          event.payload.checkpoint.spanId !== event.spanId
        ) {
          throw new TraceProjectionError(
            `Checkpoint ${event.payload.checkpoint.id} has inconsistent references.`,
          );
        }
        checkpoints.push(event.payload.checkpoint);
        break;

      case "run.ended":
        assertRunTransition(run.status, event.payload.status);
        run = runSchema.parse({
          ...run,
          status: event.payload.status,
          completedAt: event.payload.completedAt,
        });
        for (const span of spans.values()) {
          if (span.status === "running") {
            issues.push({
              code: "unclosed_span",
              message: `Span ${span.id} was still running when the run ended.`,
              spanId: span.id,
            });
          }
        }
        break;
    }
  }

  return {
    run,
    spans: [...spans.values()],
    artifacts,
    checkpoints,
    lastSequence,
    dataQualityIssues: issues,
  };
}
