import { createHash, randomUUID } from "node:crypto";
import { TraceRecorder } from "../application/trace-recorder";
import {
  schemaVersion,
  type JsonValue,
  type TraceEvent,
} from "../domain";
import type {
  CodeFixRunResult,
  ExecuteRunCommand,
  RunExecutor,
  RunStreamMessage,
  ToolExecutionResult,
} from "./contracts";
import {
  getCodeFixScenario,
  scenarioInputHash,
} from "./scenario";
import { ToolRegistry } from "./tool-registry";

const MAX_AGENT_STEPS = 12;

function inline(data: JsonValue) {
  return { kind: "inline" as const, data, redacted: false };
}

export class CodeFixRunExecutor implements RunExecutor {
  constructor(
    private readonly tools = new ToolRegistry(),
    private readonly createId = () => `codefix_${randomUUID()}`,
  ) {}

  async *execute(command: ExecuteRunCommand): AsyncIterable<RunStreamMessage> {
    const scenario = getCodeFixScenario(command.request.scenarioId);
    if (!scenario) {
      yield { type: "error", error: "Unknown code-fix scenario." };
      return;
    }

    const createdAt = new Date().toISOString();
    const runId = this.createId();
    const recorder = new TraceRecorder({
      id: runId,
      projectId: "harnesslab",
      name: `Code fix · ${scenario.name}`,
      status: "queued",
      taskType: "code_fix",
      taskInputHash: scenarioInputHash(scenario),
      parentRunId: command.branch?.parentRunId,
      forkedFromSpanId: command.branch?.forkedFromSpanId,
      configSnapshot: {
        provider: command.provider.id,
        promptVersion: "code-fix-agent-v1",
        modelParameters: {
          scenarioId: scenario.id,
          executionMode: command.request.executionMode,
        },
        toolVersions: Object.fromEntries(
          this.tools.list().map((tool) => [tool.name, tool.version]),
        ),
      },
      environmentFingerprint: {
        harnessVersion: "0.3.0",
        runtime: process.version,
        fingerprint: createHash("sha256")
          .update(
            JSON.stringify({
              scenario: scenario.id,
              runtime: process.version,
              tools: this.tools.list(),
            }),
          )
          .digest("hex")
          .slice(0, 16),
      },
      createdAt,
      schemaVersion,
    });

    const emit = (event: TraceEvent) =>
      ({ type: "trace_event" as const, event });

    yield emit(recorder.events[0]);
    yield emit(recorder.startRun());

    const agentSpanId = `${runId}:agent`;
    yield emit(
      recorder.startSpan({
        id: agentSpanId,
        kind: "agent",
        name: "code-repair-agent",
        inputRef: inline({
          scenarioId: scenario.id,
          objective: scenario.objective,
        }),
        attributes: {
          "agent.mode": command.request.executionMode,
          "agent.decision_provider": command.provider.id,
        },
      }),
    );

    const previousResults: ToolExecutionResult[] = [];
    let summary = "The code-fix agent stopped without a final decision.";

    try {
      for (let step = 0; step < MAX_AGENT_STEPS; step += 1) {
        const snapshot = await command.workspace.snapshot();
        const decisionSpanId = `${runId}:decision:${step + 1}`;

        yield emit(
          recorder.startSpan({
            id: decisionSpanId,
            parentSpanId: agentSpanId,
            kind: "model",
            name: "next-action-decision",
            inputRef: inline({
              step,
              previousResult: previousResults.at(-1)?.output ?? null,
              workspaceHash: snapshot.hash,
            }),
            attributes: {
              "agent.step": step + 1,
              "gen_ai.provider.name": command.provider.id,
            },
          }),
        );

        const storedSnapshot = command.artifactStore
          ? await command.artifactStore.put({
              runId,
              spanId: decisionSpanId,
              kind: "json",
              mediaType: "application/json",
              name: `Workspace checkpoint ${step + 1}`,
              content: JSON.stringify(snapshot.files),
              visibility: "internal",
            })
          : undefined;
        const checkpointId = `${runId}:checkpoint:${step + 1}`;
        yield emit(
          recorder.addCheckpoint({
            id: checkpointId,
            runId,
            spanId: decisionSpanId,
            stateRef: storedSnapshot
              ? `artifact://${storedSnapshot.id}`
              : snapshot.ref,
            configSnapshot: {
              scenarioId: scenario.id,
              decisionProvider: command.provider.id,
              step,
            },
            toolPolicySnapshot: Object.fromEntries(
              this.tools.list().map((tool) => [tool.name, tool.sideEffect]),
            ),
            completeness: "complete",
            blockedReasons: [],
            createdAt: new Date().toISOString(),
            schemaVersion,
          }),
        );

        const decision = await command.provider.next({
          runId,
          scenarioId: scenario.id,
          step,
          previousResults,
          availableTools: this.tools.list(),
        });

        yield emit(
          recorder.endSpan(decisionSpanId, {
            status: "success",
            outputRef: inline(decision.action),
            metrics: {
              durationMs: decision.durationMs,
              tokenUsage: decision.tokenUsage,
            },
            replayability: {
              level: "high",
              reason:
                "The model decision can be replayed from a complete workspace checkpoint.",
              checkpointId,
            },
          }),
        );

        if (decision.action.type === "finish") {
          summary = decision.action.summary;
          const successful = decision.action.outcome === "success";
          yield emit(
            recorder.endSpan(agentSpanId, {
              status: successful ? "success" : "error",
              outputRef: inline({ summary }),
              ...(successful
                ? {}
                : {
                    error: {
                      type: "unknown_error" as const,
                      code: "AGENT_STOPPED_WITHOUT_FIX",
                      message: summary,
                      retryable: true,
                    },
                  }),
            }),
          );
          yield emit(recorder.endRun(successful ? "success" : "error"));
          const result: CodeFixRunResult = {
            id: runId,
            createdAt,
            summary,
            trace: recorder.project(),
          };
          yield { type: "result", result };
          return;
        }

        const action = decision.action;
        const toolDescription = this.tools
          .list()
          .find((tool) => tool.name === action.tool);
        const toolSpanId = `${runId}:tool:${step + 1}`;
        yield emit(
          recorder.startSpan({
            id: toolSpanId,
            parentSpanId: agentSpanId,
            kind: "tool",
            name: action.tool,
            inputRef: inline(action.input),
            attributes: {
              "tool.version": toolDescription?.version ?? "unknown",
              "tool.side_effect": toolDescription?.sideEffect ?? "unknown",
            },
          }),
        );

        const toolResult = await this.tools.execute(action, {
          workspace: command.workspace,
        });
        previousResults.push(toolResult);

        const storedArtifact =
          toolResult.artifact && command.artifactStore
            ? await command.artifactStore.put({
                runId,
                spanId: toolSpanId,
                ...toolResult.artifact,
              })
            : undefined;

        if (storedArtifact) {
          yield emit(
            recorder.addArtifact({
              id: storedArtifact.id,
              runId,
              spanId: toolSpanId,
              kind: storedArtifact.kind,
              mediaType: storedArtifact.mediaType,
              storageKey: `artifact://${storedArtifact.id}`,
              contentHash: storedArtifact.contentHash,
              sizeBytes: storedArtifact.sizeBytes,
              redactionState: storedArtifact.redactionState,
              createdAt: storedArtifact.createdAt,
              schemaVersion,
            }),
          );
        }

        yield emit(
          recorder.endSpan(toolSpanId, {
            status: toolResult.status,
            outputRef: inline({
              output: toolResult.output,
              workspaceHash: toolResult.workspaceHash,
              progressHash: toolResult.progressHash,
              artifactId: storedArtifact?.id ?? null,
            }),
            metrics: { durationMs: toolResult.durationMs },
            ...(toolResult.error
              ? {
                  error: {
                    type: "tool_error" as const,
                    code: toolResult.error.code,
                    message: toolResult.error.message,
                    retryable: toolResult.error.retryable,
                  },
                }
              : {}),
          }),
        );
      }

      throw new Error(`Agent exceeded the ${MAX_AGENT_STEPS}-step limit.`);
    } catch (error) {
      summary = error instanceof Error ? error.message : "Code-fix execution failed.";
      yield emit(
        recorder.endSpan(agentSpanId, {
          status: "error",
          error: {
            type: "unknown_error",
            code: "CODE_FIX_EXECUTION_FAILED",
            message: summary,
          },
        }),
      );
      yield emit(recorder.endRun("error"));
      yield { type: "error", error: summary };
    } finally {
      await command.workspace.dispose();
    }
  }
}
