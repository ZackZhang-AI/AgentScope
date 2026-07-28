import { z } from "zod";
import { deriveRunAnalyses } from "@/lib/agentscope/analysis/analysis-record";
import { getTraceRepository } from "@/lib/agentscope/infrastructure/postgres/database";

const runIdSchema = z.string().min(1).max(200).regex(/^[a-zA-Z0-9:_-]+$/);

function storageRequired() {
  return Response.json(
    {
      code: "TRACE_STORAGE_NOT_CONFIGURED",
      error: "DATABASE_URL is required for persistent run analysis.",
    },
    { status: 503 },
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  if (!process.env.DATABASE_URL) return storageRequired();
  const runId = runIdSchema.safeParse((await params).runId);
  if (!runId.success) {
    return Response.json(
      { code: "INVALID_RUN_ID", error: "Invalid run identifier." },
      { status: 400 },
    );
  }

  try {
    const analyses = await getTraceRepository().listAnalyses(runId.data);
    return Response.json({ analyses });
  } catch {
    return Response.json(
      { code: "ANALYSIS_STORAGE_UNAVAILABLE", error: "Run analyses are unavailable." },
      { status: 503 },
    );
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  if (!process.env.DATABASE_URL) return storageRequired();
  const runId = runIdSchema.safeParse((await params).runId);
  if (!runId.success) {
    return Response.json(
      { code: "INVALID_RUN_ID", error: "Invalid run identifier." },
      { status: 400 },
    );
  }

  try {
    const repository = getTraceRepository();
    const projection = await repository.getProjection(runId.data);
    if (!projection) {
      return Response.json(
        { code: "RUN_NOT_FOUND", error: "Run not found." },
        { status: 404 },
      );
    }
    const analyses = deriveRunAnalyses(projection);
    await repository.saveAnalyses(analyses);
    return Response.json({ analyses }, { status: 201 });
  } catch {
    return Response.json(
      { code: "ANALYSIS_STORAGE_UNAVAILABLE", error: "Run analyses could not be generated." },
      { status: 503 },
    );
  }
}
