import { z } from "zod";
import { getTraceRepository } from "@/lib/agentscope/infrastructure/postgres/database";

const runIdSchema = z.string().min(1).max(200).regex(/^[a-zA-Z0-9:_-]+$/);

export async function GET(
  _request: Request,
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

  const result = runIdSchema.safeParse((await params).runId);
  if (!result.success) {
    return Response.json(
      { code: "INVALID_RUN_ID", error: "Invalid run identifier." },
      { status: 400 },
    );
  }

  try {
    const trace = await getTraceRepository().getProjection(result.data);
    if (!trace) {
      return Response.json(
        { code: "RUN_NOT_FOUND", error: "Run not found." },
        { status: 404 },
      );
    }
    return Response.json({ trace });
  } catch {
    return Response.json(
      {
        code: "TRACE_STORAGE_UNAVAILABLE",
        error: "Persistent run history is temporarily unavailable.",
      },
      { status: 503 },
    );
  }
}
