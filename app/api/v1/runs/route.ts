import { z } from "zod";
import { runStatusSchema } from "@/lib/agentscope/domain";
import { getTraceRepository } from "@/lib/agentscope/infrastructure/postgres/database";
import {
  CodeFixRunExecutor,
  FileWorkspaceSandbox,
  codeFixRunRequestSchema,
  createDecisionProvider,
  getCodeFixScenario,
  isDockerSandboxAvailable,
  reserveIdempotentRun,
} from "@/lib/agentscope/execution";
import { getArtifactStore } from "@/lib/agentscope/infrastructure/postgres/database";
import { createRunSseResponse } from "@/lib/agentscope/transport/run-sse-response";
import { incrementRuntimeMetric } from "@/lib/agentscope/observability/runtime-metrics";

const listRunsQuerySchema = z.object({
  projectId: z.string().min(1).max(100).optional(),
  status: runStatusSchema.optional(),
  provider: z.string().min(1).max(100).optional(),
  query: z.string().trim().min(1).max(200).optional(),
  createdAfter: z.iso.datetime().optional(),
  createdBefore: z.iso.datetime().optional(),
  sort: z.enum(["newest", "oldest"]).default("newest"),
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
    provider: url.searchParams.get("provider") ?? undefined,
    query: url.searchParams.get("query") ?? undefined,
    createdAfter: url.searchParams.get("createdAfter") ?? undefined,
    createdBefore: url.searchParams.get("createdBefore") ?? undefined,
    sort: url.searchParams.get("sort") ?? undefined,
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

export async function POST(request: Request) {
  const parsed = codeFixRunRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      {
        code: "INVALID_CODE_FIX_RUN",
        error: "Invalid code-fix run request.",
        issues: parsed.error.issues.map((issue) => issue.message),
      },
      { status: 400 },
    );
  }
  if (parsed.data.executionMode === "recorded") {
    return Response.json(
      {
        code: "RECORDED_DEMO_AVAILABLE",
        demoUrl: "/demos/code-fix-loop",
        apiUrl: "/api/v1/code-fix-demo",
      },
      { status: 200 },
    );
  }
  if (!process.env.DATABASE_URL) {
    return Response.json(
      {
        code: "TRACE_STORAGE_NOT_CONFIGURED",
        error: "DATABASE_URL is required for a sandbox run.",
      },
      { status: 503 },
    );
  }
  if (!(await isDockerSandboxAvailable())) {
    return Response.json(
      {
        code: "SANDBOX_UNAVAILABLE",
        error: "Docker sandbox is unavailable. Use the recorded demo.",
      },
      { status: 503 },
    );
  }
  const scenario = getCodeFixScenario(parsed.data.scenarioId);
  if (!scenario) {
    return Response.json(
      { code: "SCENARIO_NOT_FOUND", error: "Code-fix scenario was not found." },
      { status: 404 },
    );
  }
  let reservation: ReturnType<typeof reserveIdempotentRun>;
  try {
    reservation = reserveIdempotentRun(
      "run",
      request.headers.get("idempotency-key"),
      JSON.stringify(parsed.data),
    );
  } catch (error) {
    return Response.json(
      {
        code: "INVALID_IDEMPOTENCY_KEY",
        error: error instanceof Error ? error.message : "Invalid idempotency key.",
      },
      { status: 400 },
    );
  }
  if (reservation.duplicate) {
    return Response.json(
      {
        code: "IDEMPOTENT_RUN_EXISTS",
        error: "This idempotent run has already been accepted.",
        runId: reservation.runId,
      },
      { status: 409 },
    );
  }
  const workspace = await FileWorkspaceSandbox.create(scenario);
  incrementRuntimeMetric("runs_started");
  return createRunSseResponse(
    new CodeFixRunExecutor(
      undefined,
      reservation.runId ? () => reservation.runId! : undefined,
    ).execute({
      request: parsed.data,
      provider: createDecisionProvider(parsed.data.decisionProvider),
      workspace,
      artifactStore: getArtifactStore(),
    }),
    getTraceRepository(),
  );
}
