import { deriveRunAnalyses } from "../analysis/analysis-record";
import type { TraceRepository } from "../application/trace-repository";
import type { RunStreamMessage } from "../execution";
import { incrementRuntimeMetric } from "../observability/runtime-metrics";

function encodeMessage(message: RunStreamMessage) {
  const id =
    message.type === "trace_event"
      ? `id: ${message.event.sequence}\n`
      : "";
  return `${id}event: ${message.type}\ndata: ${JSON.stringify(message)}\n\n`;
}

export function createRunSseResponse(
  messages: AsyncIterable<RunStreamMessage>,
  repository: TraceRepository,
  headers: Record<string, string> = {},
) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let connected = true;
      try {
        for await (const message of messages) {
          if (message.type === "trace_event") {
            await repository.append(message.event);
            incrementRuntimeMetric("trace_events_persisted");
          }
          if (message.type === "result") {
            await repository.saveAnalyses(
              deriveRunAnalyses(message.result.trace, message.result.createdAt),
            );
            incrementRuntimeMetric(
              message.result.trace.run.parentRunId
                ? "forks_completed"
                : "runs_completed",
            );
          }
          if (!connected) continue;
          try {
            controller.enqueue(encoder.encode(encodeMessage(message)));
          } catch {
            connected = false;
            incrementRuntimeMetric("sse_disconnects");
          }
        }
      } catch (error) {
        incrementRuntimeMetric("execution_errors");
        if (connected) {
          try {
            controller.enqueue(
              encoder.encode(
                encodeMessage({
                  type: "error",
                  error:
                    error instanceof Error
                      ? error.message
                      : "AgentScope run execution failed.",
                }),
              ),
            );
          } catch {
            connected = false;
          }
        }
      } finally {
        if (connected) {
          try {
            controller.close();
          } catch {
            // The execution and persistence lifecycle already completed.
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
      "x-agentscope-resumable": "true",
      ...headers,
    },
  });
}
