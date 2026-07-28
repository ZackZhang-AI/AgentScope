import { z } from "zod";
import { getTraceRepository } from "@/lib/agentscope/infrastructure/postgres/database";
import type { TraceEvent } from "@/lib/agentscope/domain";

const paramsSchema = z.object({
  runId: z.string().min(1).max(200).regex(/^[a-zA-Z0-9:_-]+$/),
  after: z.coerce.number().int().nonnegative().default(0),
});

function toSseEvent(event: TraceEvent) {
  return `id: ${event.sequence}\nevent: trace_event\ndata: ${JSON.stringify({
    type: "trace_event",
    event,
  })}\n\n`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  if (!process.env.DATABASE_URL) {
    return Response.json(
      {
        code: "TRACE_STORAGE_NOT_CONFIGURED",
        error: "DATABASE_URL is required for persistent run history.",
      },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const lastEventId = request.headers.get("last-event-id");
  const parsed = paramsSchema.safeParse({
    runId: (await params).runId,
    after: url.searchParams.get("after") ?? lastEventId ?? undefined,
  });
  if (!parsed.success) {
    return Response.json(
      { code: "INVALID_EVENT_QUERY", error: "Invalid trace event query." },
      { status: 400 },
    );
  }

  try {
    const events = await getTraceRepository().listEventsAfter(
      parsed.data.runId,
      parsed.data.after,
    );
    if (request.headers.get("accept")?.includes("text/event-stream")) {
      return new Response(events.map(toSseEvent).join(""), {
        headers: {
          "cache-control": "no-cache, no-transform",
          "content-type": "text/event-stream; charset=utf-8",
          "x-accel-buffering": "no",
        },
      });
    }
    return Response.json({ events });
  } catch {
    return Response.json(
      {
        code: "TRACE_STORAGE_UNAVAILABLE",
        error: "Trace events are temporarily unavailable.",
      },
      { status: 503 },
    );
  }
}
