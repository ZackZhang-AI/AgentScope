import { z } from "zod";
import { getTraceRepository } from "@/lib/agentscope/infrastructure/postgres/database";

const paramsSchema = z.object({
  runId: z.string().min(1).max(200).regex(/^[a-zA-Z0-9:_-]+$/),
  after: z.coerce.number().int().nonnegative().default(0),
});

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
  const parsed = paramsSchema.safeParse({
    runId: (await params).runId,
    after: url.searchParams.get("after") ?? undefined,
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
