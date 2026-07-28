import { ZodError } from "zod";
import { runAuditStream } from "@/lib/audit/run-audit";
import { getOptionalTraceRepository } from "@/lib/agentscope/infrastructure/postgres/database";
import {
  ProviderConfigurationError,
  ProviderResponseError,
  ProviderTimeoutError,
} from "@/lib/providers/errors";
import { auditRequestSchema } from "@/lib/schemas";
import type { AuditStreamMessage } from "@/lib/types";
import type { TraceRepository } from "@/lib/agentscope/application/trace-repository";
import { createAuditSseResponse } from "@/lib/agentscope/transport/audit-sse-response";
import { deriveRunAnalyses } from "@/lib/agentscope/analysis/analysis-record";
import { incrementRuntimeMetric } from "@/lib/agentscope/observability/runtime-metrics";

function errorResponse(error: unknown) {
  if (error instanceof ProviderConfigurationError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof ProviderTimeoutError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof ProviderResponseError || error instanceof ZodError) {
    return Response.json({ error: error.message }, { status: 502 });
  }

  return Response.json({ error: "Unexpected audit failure." }, { status: 500 });
}

async function persistTraceMessage(
  repository: TraceRepository | null,
  message: AuditStreamMessage,
) {
  if (repository && message.type === "trace_event") {
    await repository.append(message.event);
    incrementRuntimeMetric("trace_events_persisted");
  }
  if (repository && message.type === "result") {
    await repository.saveAnalyses(
      deriveRunAnalyses(message.result.trace, message.result.createdAt),
    );
  }
  if (message.type === "result") {
    incrementRuntimeMetric("runs_completed");
  }
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = auditRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid audit request.",
        issues: parsed.error.issues.map((issue) => issue.message),
      },
      { status: 400 },
    );
  }

  try {
    const traceRepository = getOptionalTraceRepository();
    incrementRuntimeMetric("runs_started");

    if (request.headers.get("accept") === "text/event-stream") {
      return createAuditSseResponse(
        runAuditStream(parsed.data),
        traceRepository,
      );
    }

    for await (const message of runAuditStream(parsed.data)) {
      await persistTraceMessage(traceRepository, message);
      if (message.type === "result") return Response.json(message.result);
    }

    throw new Error("Audit stream completed without a result.");
  } catch (error) {
    incrementRuntimeMetric("execution_errors");
    return errorResponse(error);
  }
}
