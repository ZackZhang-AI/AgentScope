import { AuditTraceSession } from "../agentscope/instrumentation/audit-trace-session";
import { parseAuditInput } from "../parser";
import { runAuditProvider } from "../providers";
import { generateReportMarkdown } from "../report";
import type {
  AgentEvent,
  AgentStage,
  AuditRequest,
  AuditStreamMessage,
  ProviderAuditResult,
} from "../types";
import { evaluateAudit } from "./evaluate";
import { createAgentEvent } from "./events";

export const PROMPT_VERSION = "audit-v2";

function upsertEvent(events: Map<AgentStage, AgentEvent>, event: AgentEvent) {
  events.set(event.stage, event);
  return event;
}

export async function* runAuditStream(
  request: AuditRequest,
): AsyncGenerator<AuditStreamMessage> {
  const startedAt = new Date();
  const input = parseAuditInput(request);
  const events = new Map<AgentStage, AgentEvent>();
  const files = input.files.length ? input.files.join(", ") : "pasted content";
  const traceSession = new AuditTraceSession({
    request,
    parsedInput: input,
    promptVersion: PROMPT_VERSION,
    startedAt,
  });

  for (const event of traceSession.start()) {
    yield { type: "trace_event", event };
  }
  for (const event of traceSession.recordIntake()) {
    yield { type: "trace_event", event };
  }
  yield {
    type: "trace",
    event: upsertEvent(
      events,
      createAgentEvent(
        "intake",
        "complete",
        `Parsed ${input.estimatedLines} lines from ${files}.`,
        { artifact: `contentHash=${input.contentHash}` },
      ),
    ),
  };

  for (const event of traceSession.recordPlan()) {
    yield { type: "trace_event", event };
  }
  yield {
    type: "trace",
    event: upsertEvent(
      events,
      createAgentEvent(
        "plan",
        "complete",
        `Planned a ${request.intensity} audit for: ${request.rules.join(", ")}.`,
        { artifact: `promptVersion=${PROMPT_VERSION}` },
      ),
    ),
  };

  const inspectionStarted = Date.now();
  yield { type: "trace_event", event: traceSession.startInspection() };
  yield {
    type: "trace",
    event: upsertEvent(
      events,
      createAgentEvent(
        "inspect",
        "running",
        `Sending the normalized input to the ${request.provider} provider.`,
      ),
    ),
  };

  let providerResult: ProviderAuditResult;
  try {
    providerResult = await runAuditProvider(request);
  } catch (error) {
    for (const event of traceSession.failInspection(
      error,
      Date.now() - inspectionStarted,
    )) {
      yield { type: "trace_event", event };
    }
    throw error;
  }

  yield {
    type: "trace_event",
    event: traceSession.completeInspection(
      providerResult,
      Date.now() - inspectionStarted,
    ),
  };
  yield {
    type: "trace",
    event: upsertEvent(
      events,
      createAgentEvent(
        "inspect",
        "complete",
        `Provider inspection completed with ${providerResult.model ?? request.provider}.`,
        { durationMs: Date.now() - inspectionStarted },
      ),
    ),
  };

  const hasBlockingFinding = providerResult.findings.some(
    (finding) =>
      finding.severity === "critical" || finding.severity === "high",
  );
  for (const event of traceSession.recordFindings(
    providerResult.findings.length,
    hasBlockingFinding,
  )) {
    yield { type: "trace_event", event };
  }
  yield {
    type: "trace",
    event: upsertEvent(
      events,
      createAgentEvent(
        "finding",
        hasBlockingFinding ? "warning" : "complete",
        `Extracted ${providerResult.findings.length} structured finding${
          providerResult.findings.length === 1 ? "" : "s"
        }.`,
      ),
    ),
  };

  const evaluationEvent = createAgentEvent(
    "evaluate",
    "complete",
    "Calculated deterministic process-quality scores from trace and finding coverage.",
  );
  const evaluationEvents = [...events.values(), evaluationEvent];
  const evalCard = evaluateAudit(
    request,
    request.provider,
    evaluationEvents,
    providerResult.findings,
  );
  for (const event of traceSession.recordEvaluation(evalCard)) {
    yield { type: "trace_event", event };
  }
  yield {
    type: "trace",
    event: upsertEvent(events, evaluationEvent),
  };

  yield { type: "trace_event", event: traceSession.startReport() };
  const reportEvent = createAgentEvent(
    "report",
    "complete",
    "Generated Markdown and JSON artifacts for review handoff.",
  );
  upsertEvent(events, reportEvent);

  const completedAt = new Date();
  const metrics = {
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - startedAt.getTime(),
    providerLatencyMs: providerResult.providerLatencyMs,
    promptVersion: PROMPT_VERSION,
    tokenUsage: providerResult.tokenUsage,
  };
  const reportMarkdown = generateReportMarkdown({
    summary: providerResult.summary,
    riskScore: providerResult.riskScore,
    findings: providerResult.findings,
    evalCard,
    provider: request.provider,
    model: providerResult.model,
    metrics,
    rules: request.rules,
  });
  const completedTrace = traceSession.finishReport(
    reportMarkdown,
    hasBlockingFinding,
  );
  for (const event of completedTrace.events) {
    yield { type: "trace_event", event };
  }

  yield { type: "trace", event: reportEvent };
  yield {
    type: "result",
    result: {
      id: traceSession.runId,
      createdAt: completedAt.toISOString(),
      provider: request.provider,
      model: providerResult.model,
      summary: providerResult.summary,
      riskScore: providerResult.riskScore,
      inputMeta: {
        inputType: request.inputType,
        intensity: request.intensity,
        rules: request.rules,
        contentHash: input.contentHash,
        estimatedLines: input.estimatedLines,
        source: request.source,
      },
      metrics,
      events: [...events.values()],
      trace: completedTrace.trace,
      findings: providerResult.findings,
      evalCard,
      reportMarkdown,
    },
  };
}

export async function runAudit(request: AuditRequest) {
  for await (const message of runAuditStream(request)) {
    if (message.type === "result") return message.result;
  }

  throw new Error("Audit stream completed without a result.");
}
