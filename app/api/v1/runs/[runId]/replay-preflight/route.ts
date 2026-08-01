import { z } from "zod";
import { getTraceRepository } from "@/lib/agentscope/infrastructure/postgres/database";
import { buildReplayPreflight } from "@/lib/agentscope/replay/preflight";

export const runtime = "nodejs";

const requestSchema = z
  .object({ targetSpanId: z.string().min(1) })
  .strict();

export async function POST(
  request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  if (!process.env.DATABASE_URL) {
    return Response.json(
      {
        code: "TRACE_STORAGE_NOT_CONFIGURED",
        error: "DATABASE_URL is required for server-side replay preflight.",
      },
      { status: 503 },
    );
  }
  const { runId } = await context.params;
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { code: "INVALID_REPLAY_REQUEST", error: "Invalid replay request." },
      { status: 400 },
    );
  }
  const projection = await getTraceRepository().getProjection(runId);
  if (!projection) {
    return Response.json(
      { code: "RUN_NOT_FOUND", error: "Parent run was not found." },
      { status: 404 },
    );
  }
  const preflight = buildReplayPreflight(
    projection,
    parsed.data.targetSpanId,
  );
  return Response.json(
    { preflight },
    { status: preflight.status === "blocked" ? 409 : 200 },
  );
}
