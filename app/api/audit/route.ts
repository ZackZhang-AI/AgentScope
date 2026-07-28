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

function sseMessage(message: AuditStreamMessage) {
  const id = message.type === "trace_event"
    ? `id: ${message.event.sequence}\n`
    : "";
  return `${id}event: ${message.type}\ndata: ${JSON.stringify(message)}\n\n`;
}

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

    if (request.headers.get("accept") === "text/event-stream") {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          let clientConnected = true;
          try {
            for await (const message of runAuditStream(parsed.data)) {
              await persistTraceMessage(traceRepository, message);
              if (clientConnected) {
                try {
                  controller.enqueue(encoder.encode(sseMessage(message)));
                } catch {
                  clientConnected = false;
                }
              }
            }
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Unexpected audit failure.";
            if (clientConnected) {
              try {
                controller.enqueue(
                  encoder.encode(
                    sseMessage({
                      type: "error",
                      error: message,
                    }),
                  ),
                );
              } catch {
                clientConnected = false;
              }
            }
          } finally {
            if (clientConnected) {
              try {
                controller.close();
              } catch {
                // The client may disconnect after the final message is persisted.
              }
            }
          }
        },
      });

      return new Response(stream, {
        headers: {
          "cache-control": "no-cache, no-transform",
          connection: "keep-alive",
          "content-type": "text/event-stream; charset=utf-8",
          "x-accel-buffering": "no",
          "x-agentscope-resumable": traceRepository ? "true" : "false",
        },
      });
    }

    for await (const message of runAuditStream(parsed.data)) {
      await persistTraceMessage(traceRepository, message);
      if (message.type === "result") return Response.json(message.result);
    }

    throw new Error("Audit stream completed without a result.");
  } catch (error) {
    return errorResponse(error);
  }
}
