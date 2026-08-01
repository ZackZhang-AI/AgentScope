import { traceEventSchema, type TraceEvent } from "../agentscope/domain";
import type { AuditStreamMessage } from "../types";

export type AuditStreamCursor = {
  runId?: string;
  lastSequence: number;
  resultReceived: boolean;
  errorReceived: boolean;
};

function deliverBlock(
  block: string,
  onMessage: (message: AuditStreamMessage) => void,
  cursor: AuditStreamCursor,
) {
  const data = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  if (!data) return;

  const message = JSON.parse(data) as AuditStreamMessage;
  onMessage(message);

  if (message.type === "trace_event") {
    cursor.runId = message.event.runId;
    cursor.lastSequence = Math.max(cursor.lastSequence, message.event.sequence);
  } else if (message.type === "result") {
    cursor.resultReceived = true;
  } else if (message.type === "error") {
    cursor.errorReceived = true;
  }
}

export async function consumeAuditStream(
  response: Response,
  onMessage: (message: AuditStreamMessage) => void,
): Promise<AuditStreamCursor> {
  if (!response.body) {
    throw new Error("The audit response did not include a stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const cursor: AuditStreamCursor = {
    lastSequence: 0,
    resultReceived: false,
    errorReceived: false,
  };
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? "";

    for (const block of blocks) deliverBlock(block, onMessage, cursor);

    if (done) {
      if (buffer.trim()) deliverBlock(buffer, onMessage, cursor);
      return cursor;
    }
  }
}

export class TraceResumeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TraceResumeError";
  }
}

export type ResumeTraceOptions = {
  runId: string;
  after: number;
  onEvent: (event: TraceEvent) => void;
  fetcher?: typeof fetch;
  attempts?: number;
  pollIntervalMs?: number;
  wait?: (milliseconds: number) => Promise<void>;
};

export type ResumeTraceResult = {
  runId: string;
  lastSequence: number;
  recoveredEvents: number;
  status: "running" | "terminal";
};

export async function resumeTraceEvents({
  runId,
  after,
  onEvent,
  fetcher = fetch,
  attempts = 8,
  pollIntervalMs = 250,
  wait = (milliseconds) =>
    new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds)),
}: ResumeTraceOptions): Promise<ResumeTraceResult> {
  let lastSequence = after;
  let recoveredEvents = 0;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetcher(
      `/api/v1/runs/${encodeURIComponent(runId)}/events?after=${lastSequence}`,
      { headers: { accept: "application/json" } },
    );
    if (!response.ok) {
      throw new TraceResumeError(
        response.status === 503
          ? "Persistent trace storage is not available for stream recovery."
          : `Trace recovery failed with HTTP ${response.status}.`,
      );
    }

    const payload = await response.json() as { events?: unknown[] };
    const events = (payload.events ?? []).map((event) => traceEventSchema.parse(event));
    for (const event of events) {
      if (event.sequence <= lastSequence) continue;
      onEvent(event);
      lastSequence = event.sequence;
      recoveredEvents += 1;
      if (event.type === "run.ended") {
        return { runId, lastSequence, recoveredEvents, status: "terminal" };
      }
    }

    const runResponse = await fetcher(`/api/v1/runs/${encodeURIComponent(runId)}`, {
      headers: { accept: "application/json" },
    });
    if (runResponse.ok) {
      const runPayload = await runResponse.json() as {
        trace?: { run?: { status?: string }; lastSequence?: number };
      };
      const status = runPayload.trace?.run?.status;
      if (status && status !== "queued" && status !== "running") {
        return {
          runId,
          lastSequence: Math.max(
            lastSequence,
            runPayload.trace?.lastSequence ?? lastSequence,
          ),
          recoveredEvents,
          status: "terminal",
        };
      }
    }

    if (attempt < attempts - 1) await wait(pollIntervalMs);
  }

  return { runId, lastSequence, recoveredEvents, status: "running" };
}
