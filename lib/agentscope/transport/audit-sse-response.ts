import { deriveRunAnalyses } from "../analysis/analysis-record";
import type { TraceRepository } from "../application/trace-repository";
import type { AuditStreamMessage } from "../../types";

function sseMessage(message: AuditStreamMessage) {
  const id = message.type === "trace_event"
    ? `id: ${message.event.sequence}\n`
    : "";
  return `${id}event: ${message.type}\ndata: ${JSON.stringify(message)}\n\n`;
}

async function persistMessage(
  repository: TraceRepository | null,
  message: AuditStreamMessage,
) {
  if (!repository) return;
  if (message.type === "trace_event") {
    await repository.append(message.event);
  } else if (message.type === "result") {
    await repository.saveAnalyses(
      deriveRunAnalyses(message.result.trace, message.result.createdAt),
    );
  }
}

export function createAuditSseResponse(
  messages: AsyncIterable<AuditStreamMessage>,
  repository: TraceRepository | null,
  headers: Record<string, string> = {},
) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let clientConnected = true;
      try {
        for await (const message of messages) {
          await persistMessage(repository, message);
          if (!clientConnected) continue;
          try {
            controller.enqueue(encoder.encode(sseMessage(message)));
          } catch {
            clientConnected = false;
          }
        }
      } catch (error) {
        if (clientConnected) {
          try {
            controller.enqueue(
              encoder.encode(
                sseMessage({
                  type: "error",
                  error: error instanceof Error
                    ? error.message
                    : "Unexpected AgentScope execution failure.",
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
            // The final message was persisted before the transport disconnected.
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
      "x-agentscope-resumable": repository ? "true" : "false",
      ...headers,
    },
  });
}
