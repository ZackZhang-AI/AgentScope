import { describe, expect, it, vi } from "vitest";
import successfulFixture from "../fixtures/agentscope/successful-code-audit.json";
import { traceFixtureSchema } from "../lib/agentscope/domain";
import {
  consumeAuditStream,
  resumeTraceEvents,
} from "../lib/client/audit-stream";
import type { AuditStreamMessage } from "../lib/types";

describe("audit stream recovery", () => {
  it("parses chunked CRLF SSE frames and returns the latest trace cursor", async () => {
    const fixture = traceFixtureSchema.parse(successfulFixture);
    const first = fixture.events[0];
    const message: AuditStreamMessage = { type: "trace_event", event: first };
    const encoded = new TextEncoder().encode(
      `id: 1\r\nevent: trace_event\r\ndata: ${JSON.stringify(message)}\r\n\r\n`,
    );
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoded.slice(0, 17));
        controller.enqueue(encoded.slice(17));
        controller.close();
      },
    });
    const messages: AuditStreamMessage[] = [];

    const cursor = await consumeAuditStream(
      new Response(stream),
      (received) => messages.push(received),
    );

    expect(messages).toEqual([message]);
    expect(cursor).toEqual({
      runId: first.runId,
      lastSequence: first.sequence,
      resultReceived: false,
      errorReceived: false,
    });
  });

  it("resumes after a sequence cursor without delivering duplicate events", async () => {
    const fixture = traceFixtureSchema.parse(successfulFixture);
    const after = 10;
    const remaining = fixture.events.filter((event) => event.sequence > after);
    const received: number[] = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/events?")) {
        return Response.json({ events: remaining });
      }
      return Response.json({ trace: { run: { status: "success" } } });
    });

    const result = await resumeTraceEvents({
      runId: fixture.events[0].runId,
      after,
      onEvent: (event) => received.push(event.sequence),
      fetcher,
      wait: async () => undefined,
    });

    expect(received).toEqual(remaining.map((event) => event.sequence));
    expect(result).toEqual({
      runId: fixture.events[0].runId,
      lastSequence: fixture.events.at(-1)?.sequence,
      recoveredEvents: remaining.length,
      status: "terminal",
    });
  });
});
