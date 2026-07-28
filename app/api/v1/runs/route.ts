import { z } from "zod";
import { runStatusSchema } from "@/lib/agentscope/domain";
import { getTraceRepository } from "@/lib/agentscope/infrastructure/postgres/database";

const listRunsQuerySchema = z.object({
  projectId: z.string().min(1).max(100).optional(),
  status: runStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function GET(request: Request) {
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
  const parsed = listRunsQuerySchema.safeParse({
    projectId: url.searchParams.get("projectId") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json(
      {
        code: "INVALID_RUN_QUERY",
        error: "Invalid run list query.",
        issues: parsed.error.issues.map((issue) => issue.message),
      },
      { status: 400 },
    );
  }

  try {
    const runs = await getTraceRepository().listRuns(parsed.data);
    return Response.json({ runs });
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
