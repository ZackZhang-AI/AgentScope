import {
  artifactSchema,
  assertRunTransition,
  assertSpanTransition,
  projectTraceEvents,
  replayCheckpointSchema,
  runSchema,
  schemaVersion,
  spanSchema,
  type Artifact,
  type PayloadRef,
  type ReplayCheckpoint,
  type Replayability,
  type Run,
  type RunProjection,
  type Span,
  type SpanKind,
  type SpanMetrics,
  type TerminalRunStatus,
  type TerminalSpanStatus,
  type TraceError,
  type TraceEvent,
} from "../domain";
import type { JsonValue } from "../domain/common";

type Clock = () => string;

type StartSpanInput = {
  id: string;
  parentSpanId?: string;
  kind: SpanKind;
  name: string;
  inputRef?: PayloadRef;
  attributes?: Record<string, JsonValue>;
};

type EndSpanInput = {
  status: TerminalSpanStatus;
  outputRef?: PayloadRef;
  metrics?: SpanMetrics;
  error?: TraceError;
  replayability?: Replayability;
};

type TraceEventInput =
  | Omit<
      Extract<TraceEvent, { type: "run.created" }>,
      "eventId" | "runId" | "sequence" | "receivedAt" | "schemaVersion"
    >
  | Omit<
      Extract<TraceEvent, { type: "run.started" }>,
      "eventId" | "runId" | "sequence" | "receivedAt" | "schemaVersion"
    >
  | Omit<
      Extract<TraceEvent, { type: "span.started" }>,
      "eventId" | "runId" | "sequence" | "receivedAt" | "schemaVersion"
    >
  | Omit<
      Extract<TraceEvent, { type: "span.ended" }>,
      "eventId" | "runId" | "sequence" | "receivedAt" | "schemaVersion"
    >
  | Omit<
      Extract<TraceEvent, { type: "artifact.created" }>,
      "eventId" | "runId" | "sequence" | "receivedAt" | "schemaVersion"
    >
  | Omit<
      Extract<TraceEvent, { type: "checkpoint.created" }>,
      "eventId" | "runId" | "sequence" | "receivedAt" | "schemaVersion"
    >
  | Omit<
      Extract<TraceEvent, { type: "run.ended" }>,
      "eventId" | "runId" | "sequence" | "receivedAt" | "schemaVersion"
    >;

export class TraceRecorder {
  readonly #events: TraceEvent[] = [];
  readonly #spans = new Map<string, Span>();
  readonly #clock: Clock;
  #run: Run;
  #sequence = 0;

  constructor(run: Run, clock: Clock = () => new Date().toISOString()) {
    this.#run = runSchema.parse(run);
    this.#clock = clock;
    this.#events.push(
      this.#createEvent({
        type: "run.created",
        occurredAt: run.createdAt,
        payload: { run: this.#run },
      }),
    );
  }

  get events(): readonly TraceEvent[] {
    return this.#events;
  }

  get run(): Run {
    return this.#run;
  }

  startRun(): TraceEvent {
    assertRunTransition(this.#run.status, "running");
    const startedAt = this.#clock();
    this.#run = runSchema.parse({
      ...this.#run,
      status: "running",
      startedAt,
    });
    return this.#append({
      type: "run.started",
      occurredAt: startedAt,
      payload: { startedAt },
    });
  }

  startSpan(input: StartSpanInput): TraceEvent {
    if (this.#run.status !== "running") {
      throw new Error(`Cannot start a span while run is ${this.#run.status}.`);
    }
    if (this.#spans.has(input.id)) {
      throw new Error(`Span ${input.id} has already started.`);
    }
    if (input.parentSpanId && !this.#spans.has(input.parentSpanId)) {
      throw new Error(`Parent span ${input.parentSpanId} has not started.`);
    }

    const startedAt = this.#clock();
    const span = spanSchema.parse({
      ...input,
      runId: this.#run.id,
      status: "running",
      sequence: this.#sequence + 1,
      startedAt,
      attributes: input.attributes ?? {},
      schemaVersion,
    });
    this.#spans.set(span.id, span);

    if (!span.parentSpanId && !this.#run.rootSpanId) {
      this.#run = runSchema.parse({ ...this.#run, rootSpanId: span.id });
    }

    return this.#append({
      type: "span.started",
      spanId: span.id,
      occurredAt: startedAt,
      payload: { span },
    });
  }

  endSpan(spanId: string, input: EndSpanInput): TraceEvent {
    const span = this.#spans.get(spanId);
    if (!span) throw new Error(`Unknown span ${spanId}.`);

    assertSpanTransition(span.status, input.status);
    const endedAt = this.#clock();
    const completed = spanSchema.parse({
      ...span,
      ...input,
      endedAt,
    });
    this.#spans.set(spanId, completed);

    return this.#append({
      type: "span.ended",
      spanId,
      occurredAt: endedAt,
      payload: {
        ...input,
        endedAt,
      },
    });
  }

  addArtifact(input: Artifact): TraceEvent {
    const artifact = artifactSchema.parse(input);
    if (artifact.runId !== this.#run.id) {
      throw new Error(`Artifact ${artifact.id} belongs to a different run.`);
    }
    return this.#append({
      type: "artifact.created",
      spanId: artifact.spanId,
      occurredAt: artifact.createdAt,
      payload: { artifact },
    });
  }

  addCheckpoint(input: ReplayCheckpoint): TraceEvent {
    const checkpoint = replayCheckpointSchema.parse(input);
    if (checkpoint.runId !== this.#run.id) {
      throw new Error(
        `Checkpoint ${checkpoint.id} belongs to a different run.`,
      );
    }
    if (!this.#spans.has(checkpoint.spanId)) {
      throw new Error(`Unknown checkpoint span ${checkpoint.spanId}.`);
    }
    return this.#append({
      type: "checkpoint.created",
      spanId: checkpoint.spanId,
      occurredAt: checkpoint.createdAt,
      payload: { checkpoint },
    });
  }

  endRun(status: TerminalRunStatus): TraceEvent {
    assertRunTransition(this.#run.status, status);
    const completedAt = this.#clock();
    this.#run = runSchema.parse({
      ...this.#run,
      status,
      completedAt,
    });
    return this.#append({
      type: "run.ended",
      occurredAt: completedAt,
      payload: { status, completedAt },
    });
  }

  project(): RunProjection {
    return projectTraceEvents(this.#events);
  }

  #append(input: TraceEventInput): TraceEvent {
    const event = this.#createEvent(input);
    this.#events.push(event);
    return event;
  }

  #createEvent(input: TraceEventInput): TraceEvent {
    const sequence = ++this.#sequence;
    return {
      ...input,
      eventId: `${this.#run.id}:event:${sequence}`,
      runId: this.#run.id,
      sequence,
      receivedAt: this.#clock(),
      schemaVersion,
    } as TraceEvent;
  }
}
