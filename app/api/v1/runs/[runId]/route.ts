import { z } from "zod";
import { getTraceRepository } from "@/lib/agentscope/infrastructure/postgres/database";

const runIdSchema = z.string().min(1).max(200).regex(/^[a-zA-Z0-9:_-]+$/);
const runMetadataSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    tags: z
      .array(z.string().trim().min(1).max(32))
      .max(20)
      .transform((tags) => [...new Set(tags)])
      .optional(),
  })
  .strict()
  .refine((input) => input.name !== undefined || input.tags !== undefined, {
    message: "At least one metadata field is required.",
  });

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

export async function PATCH(
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

  const runId = runIdSchema.safeParse((await params).runId);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { code: "INVALID_RUN_METADATA", error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }
  const metadata = runMetadataSchema.safeParse(body);
  if (!runId.success || !metadata.success) {
    return Response.json(
      { code: "INVALID_RUN_METADATA", error: "Invalid run metadata." },
      { status: 400 },
    );
  }

  try {
    const run = await getTraceRepository().updateRunMetadata(
      runId.data,
      metadata.data,
    );
    if (!run) {
      return Response.json(
        { code: "RUN_NOT_FOUND", error: "Run not found." },
        { status: 404 },
      );
    }
    return Response.json({ run });
  } catch {
    return Response.json(
      {
        code: "TRACE_STORAGE_UNAVAILABLE",
        error: "Run metadata could not be updated.",
      },
      { status: 503 },
    );
  }
}
