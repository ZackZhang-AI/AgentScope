import { z } from "zod";
import {
  CodeFixRunExecutor,
  FileWorkspaceSandbox,
  codeFixRunRequestSchema,
  createDecisionProvider,
  getCodeFixScenario,
  isDockerSandboxAvailable,
  isSandboxExecutionEnabled,
  reserveIdempotentRun,
  sandboxDisabledResponse,
} from "@/lib/agentscope/execution";
import {
  getArtifactStore,
  getTraceRepository,
} from "@/lib/agentscope/infrastructure/postgres/database";
import { buildReplayPreflight } from "@/lib/agentscope/replay/preflight";
import { createRunSseResponse } from "@/lib/agentscope/transport/run-sse-response";
import { incrementRuntimeMetric } from "@/lib/agentscope/observability/runtime-metrics";

export const runtime = "nodejs";

const forkSchema = z
  .object({
    targetSpanId: z.string().min(1),
    decisionProvider: z.enum(["fixture", "deepseek", "minimax"]).default("fixture"),
  })
  .strict();

function artifactId(stateRef: string) {
  return stateRef.startsWith("artifact://")
    ? stateRef.slice("artifact://".length)
    : null;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  if (!isSandboxExecutionEnabled()) {
    return sandboxDisabledResponse();
  }
  if (!process.env.DATABASE_URL) {
    return Response.json(
      {
        code: "TRACE_STORAGE_NOT_CONFIGURED",
        error: "DATABASE_URL is required for a persistent child run.",
      },
      { status: 503 },
    );
  }
  const parsed = forkSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { code: "INVALID_FORK_REQUEST", error: "Invalid fork request." },
      { status: 400 },
    );
  }
  const { runId } = await context.params;
  const repository = getTraceRepository();
  const artifactStore = getArtifactStore();
  const parent = await repository.getProjection(runId);
  if (!parent) {
    return Response.json(
      { code: "RUN_NOT_FOUND", error: "Parent run was not found." },
      { status: 404 },
    );
  }
  if (parent.run.taskType !== "code_fix") {
    return Response.json(
      {
        code: "UNSUPPORTED_FORK_TASK",
        error: "This endpoint only supports code-fix runs.",
      },
      { status: 422 },
    );
  }
  const preflight = buildReplayPreflight(parent, parsed.data.targetSpanId);
  if (preflight.status === "blocked") {
    incrementRuntimeMetric("replay_preflight_rejections");
    return Response.json(
      {
        code: "REPLAY_PREFLIGHT_BLOCKED",
        error: "Replay preflight blocked this fork.",
        preflight,
      },
      { status: 409 },
    );
  }
  const checkpoint = parent.checkpoints.find(
    (item) => item.id === preflight.checkpointId,
  );
  const snapshotArtifactId = checkpoint
    ? artifactId(checkpoint.stateRef)
    : null;
  const snapshotArtifact = snapshotArtifactId
    ? await artifactStore.get(snapshotArtifactId)
    : null;
  if (!snapshotArtifact || snapshotArtifact.visibility !== "internal") {
    return Response.json(
      {
        code: "CHECKPOINT_STATE_UNAVAILABLE",
        error: "The replay checkpoint workspace snapshot is unavailable.",
      },
      { status: 409 },
    );
  }
  let files: Record<string, string>;
  try {
    files = z.record(z.string(), z.string()).parse(
      JSON.parse(snapshotArtifact.content),
    );
  } catch {
    return Response.json(
      {
        code: "CHECKPOINT_STATE_INVALID",
        error: "The replay checkpoint workspace snapshot is invalid.",
      },
      { status: 409 },
    );
  }
  const scenario = getCodeFixScenario("buggy-auth-api");
  if (!scenario) {
    return Response.json(
      { code: "SCENARIO_UNAVAILABLE", error: "Code-fix scenario is unavailable." },
      { status: 503 },
    );
  }
  if (!(await isDockerSandboxAvailable())) {
    return Response.json(
      {
        code: "SANDBOX_UNAVAILABLE",
        error: "Docker sandbox is unavailable. Use the recorded demo branch.",
      },
      { status: 503 },
    );
  }
  let reservation: ReturnType<typeof reserveIdempotentRun>;
  try {
    reservation = reserveIdempotentRun(
      "fork",
      request.headers.get("idempotency-key"),
      JSON.stringify({
        runId,
        targetSpanId: parsed.data.targetSpanId,
        decisionProvider: parsed.data.decisionProvider,
      }),
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
        error: "This idempotent fork has already been accepted.",
        runId: reservation.runId,
      },
      { status: 409 },
    );
  }
  const workspace = await FileWorkspaceSandbox.create(
    scenario,
    undefined,
    files,
  );
  const runRequest = codeFixRunRequestSchema.parse({
    taskType: "code_fix",
    scenarioId: scenario.id,
    executionMode: "sandbox",
    decisionProvider: parsed.data.decisionProvider,
  });
  incrementRuntimeMetric("forks_started");
  return createRunSseResponse(
    new CodeFixRunExecutor(
      undefined,
      reservation.runId ? () => reservation.runId! : undefined,
    ).execute({
      request: runRequest,
      provider: createDecisionProvider(
        parsed.data.decisionProvider,
        "repair",
      ),
      workspace,
      artifactStore,
      branch: {
        parentRunId: runId,
        forkedFromSpanId: parsed.data.targetSpanId,
      },
    }),
    repository,
    { "x-agentscope-parent-run": runId },
  );
}
