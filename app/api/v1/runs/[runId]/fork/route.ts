import { parseAuditInput } from "@/lib/parser";
import { runAuditStream } from "@/lib/audit/run-audit";
import { getOptionalTraceRepository } from "@/lib/agentscope/infrastructure/postgres/database";
import { buildReplayPreflight } from "@/lib/agentscope/replay/preflight";
import { replayForkRequestSchema } from "@/lib/schemas";
import { createAuditSseResponse } from "@/lib/agentscope/transport/audit-sse-response";
import { incrementRuntimeMetric } from "@/lib/agentscope/observability/runtime-metrics";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const { runId } = await context.params;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = replayForkRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid fork request.",
        issues: parsed.error.issues.map((issue) => issue.message),
      },
      { status: 400 },
    );
  }

  const repository = getOptionalTraceRepository();
  const storedProjection = repository
    ? await repository.getProjection(runId)
    : null;
  const parent = storedProjection ?? parsed.data.parentProjection;

  if (!parent || parent.run.id !== runId) {
    return Response.json({ error: "Parent run was not found." }, { status: 404 });
  }

  const normalizedInput = parseAuditInput(parsed.data.request);
  if (normalizedInput.contentHash !== parent.run.taskInputHash) {
    return Response.json(
      { error: "Fork input does not match the parent task input." },
      { status: 409 },
    );
  }

  const target = parent.spans.find((span) => span.id === parsed.data.targetSpanId);
  const preflight = buildReplayPreflight(parent, parsed.data.targetSpanId);
  if (preflight.status === "blocked") {
    incrementRuntimeMetric("replay_preflight_rejections");
    return Response.json(
      { error: "Replay preflight blocked this fork.", preflight },
      { status: 409 },
    );
  }
  if (!target || target.kind !== "model" || target.name !== "provider-inspection") {
    incrementRuntimeMetric("replay_preflight_rejections");
    return Response.json(
      {
        error: "This HarnessLab executor currently supports forks from provider-inspection model spans only.",
        preflight,
      },
      { status: 422 },
    );
  }

  incrementRuntimeMetric("forks_started");
  return createAuditSseResponse(
    runAuditStream(parsed.data.request, {
      fork: {
        parentRunId: runId,
        forkedFromSpanId: parsed.data.targetSpanId,
      },
    }),
    repository,
    {
      "x-agentscope-parent-run": runId,
    },
  );
}
