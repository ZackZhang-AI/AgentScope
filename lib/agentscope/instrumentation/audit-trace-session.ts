import { createHash } from "node:crypto";
import { TraceRecorder } from "../application/trace-recorder";
import {
  schemaVersion,
  type RunProjection,
  type TraceError,
  type TraceEvent,
} from "../domain";
import {
  ProviderConfigurationError,
  ProviderResponseError,
  ProviderTimeoutError,
} from "../../providers/errors";
import type {
  AuditRequest,
  EvalCard,
  ParsedAuditInput,
  ProviderAuditResult,
} from "../../types";

const HARNESS_VERSION = "0.2.0";

type AuditTraceSessionInput = {
  request: AuditRequest;
  parsedInput: ParsedAuditInput;
  promptVersion: string;
  startedAt: Date;
};

function toTraceError(error: unknown): TraceError {
  if (error instanceof ProviderTimeoutError) {
    return { type: "timeout", message: error.message, retryable: true };
  }

  if (error instanceof ProviderConfigurationError) {
    return {
      type: "validation_error",
      message: error.message,
      retryable: false,
    };
  }

  if (error instanceof ProviderResponseError) {
    return {
      type: "model_error",
      message: error.message,
      retryable: false,
    };
  }

  return {
    type: "unknown_error",
    message: error instanceof Error ? error.message : "Unexpected audit failure.",
  };
}

export class AuditTraceSession {
  readonly #request: AuditRequest;
  readonly #input: ParsedAuditInput;
  readonly #promptVersion: string;
  readonly #startedAt: Date;
  readonly #recorder: TraceRecorder;

  constructor({
    request,
    parsedInput,
    promptVersion,
    startedAt,
  }: AuditTraceSessionInput) {
    this.#request = request;
    this.#input = parsedInput;
    this.#promptVersion = promptVersion;
    this.#startedAt = startedAt;

    const runId = `audit_${parsedInput.contentHash}_${Date.now().toString(36)}`;
    const files = parsedInput.files.length
      ? parsedInput.files.join(", ")
      : "pasted content";
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          harnessVersion: HARNESS_VERSION,
          promptVersion,
          provider: request.provider,
          runtime: process.version,
        }),
      )
      .digest("hex")
      .slice(0, 16);

    this.#recorder = new TraceRecorder({
      id: runId,
      projectId: "harnesslab",
      name: `Code audit · ${files}`,
      status: "queued",
      taskType: "code_audit",
      taskInputHash: parsedInput.contentHash,
      configSnapshot: {
        provider: request.provider,
        promptVersion,
        modelParameters: {
          intensity: request.intensity,
          rules: request.rules,
        },
        toolVersions: {},
      },
      environmentFingerprint: {
        harnessVersion: HARNESS_VERSION,
        runtime: process.version,
        fingerprint,
      },
      createdAt: startedAt.toISOString(),
      schemaVersion,
    });
  }

  get runId() {
    return this.#recorder.run.id;
  }

  start(): TraceEvent[] {
    return [
      this.#recorder.events[0],
      this.#recorder.startRun(),
      this.#recorder.startSpan({
        id: this.#spanId("agent"),
        kind: "agent",
        name: "code-audit-agent",
        inputRef: {
          kind: "omitted",
          reason: "Source content is referenced by its normalized hash.",
          contentHash: this.#input.contentHash,
        },
        attributes: {
          "agent.version": this.#promptVersion,
          "audit.input_type": this.#request.inputType,
        },
      }),
    ];
  }

  recordIntake(): TraceEvent[] {
    return [
      this.#recorder.startSpan({
        id: this.#spanId("intake"),
        parentSpanId: this.#spanId("agent"),
        kind: "custom",
        name: "input-intake",
        attributes: {
          "audit.estimated_lines": this.#input.estimatedLines,
          "audit.content_hash": this.#input.contentHash,
        },
      }),
      this.#recorder.endSpan(this.#spanId("intake"), {
        status: "success",
        outputRef: {
          kind: "inline",
          data: {
            estimatedLines: this.#input.estimatedLines,
            files: this.#input.files,
            contentHash: this.#input.contentHash,
          },
          redacted: false,
        },
      }),
    ];
  }

  recordPlan(): TraceEvent[] {
    return [
      this.#recorder.startSpan({
        id: this.#spanId("plan"),
        parentSpanId: this.#spanId("agent"),
        kind: "plan",
        name: "explicit-review-plan",
        inputRef: {
          kind: "inline",
          data: {
            intensity: this.#request.intensity,
            rules: this.#request.rules,
          },
          redacted: false,
        },
        attributes: { "prompt.version": this.#promptVersion },
      }),
      this.#recorder.endSpan(this.#spanId("plan"), {
        status: "success",
        outputRef: {
          kind: "inline",
          data: this.#request.rules.map((rule) => `inspect:${rule}`),
          redacted: false,
        },
      }),
    ];
  }

  startInspection(): TraceEvent {
    return this.#recorder.startSpan({
      id: this.#spanId("inspect"),
      parentSpanId: this.#spanId("agent"),
      kind: "model",
      name: "provider-inspection",
      inputRef: {
        kind: "omitted",
        reason: "Code content capture is disabled in the trace; use inputMeta.",
        contentHash: this.#input.contentHash,
      },
      attributes: {
        "gen_ai.provider.name": this.#request.provider,
        "prompt.version": this.#promptVersion,
      },
    });
  }

  completeInspection(
    result: ProviderAuditResult,
    durationMs: number,
  ): TraceEvent {
    return this.#recorder.endSpan(this.#spanId("inspect"), {
      status: "success",
      outputRef: {
        kind: "inline",
        data: {
          summary: result.summary,
          riskScore: result.riskScore,
          findingCount: result.findings.length,
        },
        redacted: false,
      },
      metrics: {
        durationMs,
        tokenUsage: result.tokenUsage,
      },
    });
  }

  failInspection(error: unknown, durationMs: number): TraceEvent[] {
    const traceError = toTraceError(error);
    return [
      this.#recorder.endSpan(this.#spanId("inspect"), {
        status: "error",
        error: traceError,
        metrics: { durationMs },
      }),
      this.#recorder.endSpan(this.#spanId("agent"), {
        status: "error",
        error: traceError,
        metrics: { durationMs: Date.now() - this.#startedAt.getTime() },
      }),
      this.#recorder.endRun("error"),
    ];
  }

  recordFindings(
    findingCount: number,
    hasBlockingFinding: boolean,
  ): TraceEvent[] {
    return [
      this.#recorder.startSpan({
        id: this.#spanId("findings"),
        parentSpanId: this.#spanId("agent"),
        kind: "custom",
        name: "finding-extraction",
      }),
      this.#recorder.endSpan(this.#spanId("findings"), {
        status: "success",
        outputRef: {
          kind: "inline",
          data: { findingCount, hasBlockingFinding },
          redacted: false,
        },
      }),
    ];
  }

  recordEvaluation(evalCard: EvalCard): TraceEvent[] {
    return [
      this.#recorder.startSpan({
        id: this.#spanId("evaluate"),
        parentSpanId: this.#spanId("agent"),
        kind: "eval",
        name: "deterministic-audit-eval",
        attributes: { "eval.version": "audit-process-v1" },
      }),
      this.#recorder.endSpan(this.#spanId("evaluate"), {
        status: "success",
        outputRef: {
          kind: "inline",
          data: evalCard,
          redacted: false,
        },
      }),
    ];
  }

  startReport(): TraceEvent {
    return this.#recorder.startSpan({
      id: this.#spanId("report"),
      parentSpanId: this.#spanId("agent"),
      kind: "custom",
      name: "report-generation",
    });
  }

  finishReport(
    reportMarkdown: string,
    hasBlockingFinding: boolean,
  ): { events: TraceEvent[]; trace: RunProjection } {
    const reportCreatedAt = new Date().toISOString();
    const reportArtifactId = `${this.runId}:report`;
    const events = [
      this.#recorder.addArtifact({
        id: reportArtifactId,
        runId: this.runId,
        spanId: this.#spanId("report"),
        kind: "report",
        mediaType: "text/markdown",
        storageKey: `inline://${this.runId}/report`,
        contentHash: createHash("sha256")
          .update(reportMarkdown)
          .digest("hex")
          .slice(0, 16),
        sizeBytes: Buffer.byteLength(reportMarkdown, "utf8"),
        redactionState: "unscanned",
        createdAt: reportCreatedAt,
        schemaVersion,
      }),
      this.#recorder.endSpan(this.#spanId("report"), {
        status: "success",
        outputRef: {
          kind: "artifact",
          artifactId: reportArtifactId,
          summary: "HarnessLab audit report",
          redacted: false,
        },
      }),
      this.#recorder.endSpan(this.#spanId("agent"), {
        status: "success",
        outputRef: {
          kind: "artifact",
          artifactId: reportArtifactId,
          summary: "Completed code audit",
          redacted: false,
        },
        metrics: { durationMs: Date.now() - this.#startedAt.getTime() },
      }),
      this.#recorder.endRun(
        hasBlockingFinding ? "success_with_warnings" : "success",
      ),
    ];

    return { events, trace: this.#recorder.project() };
  }

  #spanId(stage: string) {
    return `${this.runId}:${stage}`;
  }
}
