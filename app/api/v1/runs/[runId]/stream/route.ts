import { z } from "zod";
import { getTraceRepository } from "@/lib/agentscope/infrastructure/postgres/database";
import type { TraceEvent } from "@/lib/agentscope/domain";
import { incrementRuntimeMetric } from "@/lib/agentscope/observability/runtime-metrics";

const requestSchema = z.object({
  runId: z.string().min(1).max(200).regex(/^[a-zA-Z0-9:_-]+$/),
  after: z.coerce.number().int().nonnegative().default(0),
});

function encode(event: TraceEvent) {
  return `id: ${event.sequence}\nevent: trace_event\ndata: ${JSON.stringify({
    type: "trace_event",
    event,
  })}\n\n`;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  if (!process.env.DATABASE_URL) {
    return Response.json(
      {
        code: "TRACE_STORAGE_NOT_CONFIGURED",
        error: "DATABASE_URL is required for stream recovery.",
      },
      { status: 503 },
    );
  }
  const url = new URL(request.url);
  const parsed = requestSchema.safeParse({
    runId: (await context.params).runId,
    after:
      url.searchParams.get("after") ??
      request.headers.get("last-event-id") ??
      undefined,
  });
  if (!parsed.success) {
    return Response.json(
      { code: "INVALID_STREAM_QUERY", error: "Invalid run stream query." },
      { status: 400 },
    );
  }
  if (parsed.data.after > 0) incrementRuntimeMetric("sse_resume_requests");
  const encoder = new TextEncoder();
  const repository = getTraceRepository();
  const stream = new ReadableStream({
    async start(controller) {
      let sequence = parsed.data.after;
      try {
        for (let poll = 0; poll < 120 && !request.signal.aborted; poll += 1) {
          const events = await repository.listEventsAfter(
            parsed.data.runId,
            sequence,
          );
          for (const event of events) {
            controller.enqueue(encoder.encode(encode(event)));
            sequence = event.sequence;
          }
          const projection = await repository.getProjection(parsed.data.runId);
          if (!projection) {
            controller.enqueue(
              encoder.encode(
                `event: error\ndata: ${JSON.stringify({
                  type: "error",
                  error: "Run not found.",
                })}\n\n`,
              ),
            );
            break;
          }
          if (!["queued", "running"].includes(projection.run.status)) break;
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      } finally {
        controller.close();
      }
    },
    cancel() {
      incrementRuntimeMetric("sse_disconnects");
    },
  });
  return new Response(stream, {
    headers: {
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "content-type": "text/event-stream; charset=utf-8",
      "x-accel-buffering": "no",
    },
  });
}
