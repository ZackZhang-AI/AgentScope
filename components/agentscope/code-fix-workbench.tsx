"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { TraceExplorer } from "./trace-explorer";
import { CodeFixLauncher, type AgentScopeCapabilities } from "./code-fix-launcher";
import { DemoProgress, type DemoStepId } from "./demo-progress";
import { VerifiedFixSummary } from "./verified-fix-summary";
import type {
  CodeFixRunRequest,
  CodeFixRunResult,
  RecordedCodeFixDemo,
} from "@/lib/agentscope/execution";
import type {
  RunProjection,
  TraceEvent,
} from "@/lib/agentscope/domain";
import { consumeRunStream } from "@/lib/client/run-stream";
import { diagnoseRun } from "@/lib/agentscope/diagnostics/diagnose-run";
import type { InspectorTab } from "./span-inspector";

type CodeFixWorkbenchProps = {
  initialRunId?: string;
  autoStartDemo?: boolean;
};

function appendEvent(events: TraceEvent[], event: TraceEvent) {
  if (events.some((candidate) => candidate.eventId === event.eventId)) {
    return events;
  }
  return [...events, event].sort(
    (left, right) => left.sequence - right.sequence,
  );
}

async function fetchStoredRun(runId: string) {
  const [runResponse, eventsResponse] = await Promise.all([
    fetch(`/api/v1/runs/${encodeURIComponent(runId)}`),
    fetch(`/api/v1/runs/${encodeURIComponent(runId)}/events?after=0`),
  ]);
  if (!runResponse.ok || !eventsResponse.ok) {
    throw new Error("The persisted run could not be loaded.");
  }
  const runPayload = await runResponse.json() as { trace: RunProjection };
  const eventPayload = await eventsResponse.json() as { events: TraceEvent[] };
  return { projection: runPayload.trace, events: eventPayload.events };
}

export function CodeFixWorkbench({
  initialRunId,
  autoStartDemo = false,
}: CodeFixWorkbenchProps) {
  const mainRef = useRef<HTMLElement>(null);
  const [capabilities, setCapabilities] = useState<AgentScopeCapabilities>();
  const [provider, setProvider] =
    useState<CodeFixRunRequest["decisionProvider"]>("fixture");
  const [activeResult, setActiveResult] = useState<CodeFixRunResult>();
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [parentProjection, setParentProjection] = useState<RunProjection>();
  const [demo, setDemo] = useState<RecordedCodeFixDemo>();
  const [mode, setMode] = useState<"recorded" | "sandbox">("recorded");
  const [busy, setBusy] = useState(autoStartDemo || Boolean(initialRunId));
  const [error, setError] = useState<string>();
  const [guideStep, setGuideStep] = useState<DemoStepId>("failure");
  const [focusRequest, setFocusRequest] = useState<{
    spanId: string;
    inspectorTab: InspectorTab;
    nonce: number;
  }>();

  const loadDemo = useCallback(async () => {
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch("/api/v1/code-fix-demo");
      if (!response.ok) throw new Error("Recorded code-fix demo could not be loaded.");
      const payload = await response.json() as RecordedCodeFixDemo;
      setDemo(payload);
      setMode("recorded");
      setProvider("fixture");
      setParentProjection(undefined);
      setGuideStep("failure");
      setFocusRequest(undefined);
      setActiveResult(payload.parent.result);
      setEvents(payload.parent.events);
      window.history.replaceState(null, "", "/demos/code-fix-loop");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Demo could not be loaded.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    mainRef.current?.setAttribute("data-hydrated", "true");
    void fetch("/api/v1/system/capabilities")
      .then((response) => response.json())
      .then((value: AgentScopeCapabilities) => setCapabilities(value))
      .catch(() => setCapabilities(undefined));
  }, []);

  useEffect(() => {
    if (!autoStartDemo) return;
    let cancelled = false;
    void fetch("/api/v1/code-fix-demo")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Recorded code-fix demo could not be loaded.");
        }
        return response.json() as Promise<RecordedCodeFixDemo>;
      })
      .then((payload) => {
        if (cancelled) return;
        setDemo(payload);
        setMode("recorded");
        setProvider("fixture");
        setParentProjection(undefined);
        setGuideStep("failure");
        setFocusRequest(undefined);
        setActiveResult(payload.parent.result);
        setEvents(payload.parent.events);
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Demo could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [autoStartDemo]);

  useEffect(() => {
    if (!initialRunId) return;
    let cancelled = false;
    fetchStoredRun(initialRunId)
      .then(async ({ projection, events: storedEvents }) => {
        if (cancelled) return;
        setMode("sandbox");
        setProvider(
          projection.run.configSnapshot.provider as CodeFixRunRequest["decisionProvider"],
        );
        setActiveResult({
          id: projection.run.id,
          createdAt: projection.run.createdAt,
          summary: projection.run.name,
          trace: projection,
        });
        setEvents(storedEvents);
        if (projection.run.parentRunId) {
          const parent = await fetchStoredRun(projection.run.parentRunId);
          if (!cancelled) setParentProjection(parent.projection);
        }
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "Run could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialRunId]);

  async function consumeExecution(response: Response) {
    if (!response.ok) {
      const payload = response.headers
        .get("content-type")
        ?.includes("application/json")
        ? await response.json() as { error?: string }
        : undefined;
      throw new Error(
        payload?.error ?? `Agent execution failed (HTTP ${response.status}).`,
      );
    }
    let result: CodeFixRunResult | undefined;
    await consumeRunStream(response, (message) => {
      if (message.type === "trace_event") {
        setEvents((current) => appendEvent(current, message.event));
      } else if (message.type === "result") {
        result = message.result;
        setActiveResult(message.result);
        window.history.replaceState(
          null,
          "",
          `/runs/${encodeURIComponent(message.result.id)}`,
        );
      } else if (message.type === "error") {
        setError(message.error);
      }
    });
    if (!result) throw new Error("Agent stream completed without a run result.");
    return result;
  }

  async function runSandbox() {
    setBusy(true);
    setError(undefined);
    setDemo(undefined);
    setParentProjection(undefined);
    setActiveResult(undefined);
    setEvents([]);
    setMode("sandbox");
    setGuideStep("failure");
    setFocusRequest(undefined);
    try {
      const response = await fetch("/api/v1/runs", {
        method: "POST",
        headers: {
          accept: "text/event-stream",
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          taskType: "code_fix",
          scenarioId: "buggy-auth-api",
          executionMode: "sandbox",
          decisionProvider: provider,
        } satisfies CodeFixRunRequest),
      });
      await consumeExecution(response);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sandbox run failed.");
    } finally {
      setBusy(false);
    }
  }

  async function forkFromSpan(spanId: string) {
    if (!activeResult) return false;
    setBusy(true);
    setError(undefined);
    const parent = activeResult.trace;
    try {
      if (mode === "recorded") {
        if (!demo || demo.child.result.trace.run.forkedFromSpanId !== spanId) {
          throw new Error(
            "The recorded branch starts from the first no-progress test span.",
          );
        }
        setParentProjection(parent);
        setActiveResult(demo.child.result);
        setEvents(demo.child.events);
        setGuideStep("verified");
        window.history.replaceState(null, "", "/demos/code-fix-loop?view=verified");
        return true;
      }

      setParentProjection(parent);
      setEvents([]);
      const response = await fetch(
        `/api/v1/runs/${encodeURIComponent(parent.run.id)}/forks`,
        {
          method: "POST",
          headers: {
            accept: "text/event-stream",
            "content-type": "application/json",
            "idempotency-key": crypto.randomUUID(),
          },
          body: JSON.stringify({
            targetSpanId: spanId,
            decisionProvider: provider,
          }),
        },
      );
      await consumeExecution(response);
      setGuideStep("verified");
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Fork failed.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const projection = activeResult?.trace;
  const isVerified = Boolean(
    projection?.run.status === "success" && projection.run.parentRunId,
  );
  const providerLabel = projection?.run.configSnapshot.provider ?? provider;
  const diagnostics = useMemo(
    () => projection ? diagnoseRun(projection) : [],
    [projection],
  );
  const firstFailureSpanId = diagnostics.find(
    (diagnostic) => diagnostic.ruleId === "first-unrecovered-error",
  )?.evidenceSpanIds[0];
  const noProgressDiagnostic = diagnostics.find(
    (diagnostic) => diagnostic.ruleId === "no-progress-loop",
  );
  const noProgressSpanId = noProgressDiagnostic?.evidenceSpanIds[0];
  const availableSteps: DemoStepId[] = isVerified
    ? ["verified"]
    : projection
      ? ["failure", "root-cause", "fork"]
      : [];

  function selectGuideStep(step: DemoStepId) {
    if (!availableSteps.includes(step)) return;
    setGuideStep(step);
    const spanId = step === "failure" ? firstFailureSpanId : noProgressSpanId;
    if (!spanId || step === "verified") return;
    setFocusRequest({
      spanId,
      inspectorTab: step === "fork" ? "replay" : "error",
      nonce: Date.now(),
    });
  }

  return (
    <main
      ref={mainRef}
      className="min-h-[100dvh] bg-zinc-100"
      data-hydrated="false"
    >
      <AppHeader provider={providerLabel} />
      <CodeFixLauncher
        capabilities={capabilities}
        provider={provider}
        busy={busy}
        onProviderChange={setProvider}
        onLoadDemo={() => void loadDemo()}
        onRunSandbox={() => void runSandbox()}
      />
      <DemoProgress
        current={isVerified ? "verified" : guideStep}
        available={availableSteps}
        onSelect={selectGuideStep}
      />

      <div className="mx-auto grid max-w-[1800px] gap-4 p-4 lg:p-6">
        {error ? (
          <div className="flex gap-3 border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </div>
        ) : null}

        {projection ? (
          <>
            {!isVerified ? <section
              className="grid gap-3 border-l-2 border-amber-500 bg-amber-50 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
              aria-live="polite"
            >
              <AlertTriangle className="h-5 w-5 text-amber-700" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-semibold text-zinc-950">
                  {guideStep === "failure"
                    ? "Failure: the parent ends after repeating the same test"
                    : guideStep === "root-cause"
                      ? "Root cause: workspace and test hashes never changed"
                      : "Fork: restore the safe checkpoint into a new child run"}
                </h2>
                <p className="mt-1 text-xs leading-5 text-zinc-600">
                  {guideStep === "failure"
                    ? "Inspect the earliest failed run_tests span before following the error chain."
                    : guideStep === "root-cause"
                      ? `no-progress-loop · confidence ${Math.round((noProgressDiagnostic?.confidence ?? 0) * 100)}% · evidence ${noProgressSpanId ?? "unavailable"}`
                      : "The Replay tab shows checkpoint completeness and policy checks. Fork creates a child without changing Parent events or workspace state."}
                </p>
              </div>
              {guideStep !== "fork" ? (
                <button
                  type="button"
                  onClick={() => selectGuideStep(guideStep === "failure" ? "root-cause" : "fork")}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-950 hover:bg-amber-100"
                >
                  {guideStep === "failure" ? "Locate root cause" : "Inspect safe checkpoint"}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                  Inspector Replay
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              )}
            </section> : null}

            {isVerified && parentProjection ? (
              <VerifiedFixSummary
                parent={parentProjection}
                child={projection}
                onRestart={() => void loadDemo()}
              />
            ) : null}

            <TraceExplorer
              key={`${projection.run.id}:${focusRequest?.nonce ?? "default"}`}
              events={events}
              projection={projection}
              isRunning={busy}
              provider={providerLabel}
              isForking={busy}
              onForkSpan={forkFromSpan}
              parentProjection={parentProjection}
              replayMode={mode === "recorded" ? "fixture" : "fork"}
              focusRequest={focusRequest}
            />
          </>
        ) : (
          <section className="flex min-h-80 items-center justify-center border border-dashed border-zinc-300 bg-white p-8 text-center">
            <div className="max-w-md">
              <h2 className="text-lg font-semibold text-zinc-950">
                Choose how to inspect the code-repair agent
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                The recorded path is always available. Local sandbox execution
                appears when PostgreSQL and Docker are ready.
              </p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
