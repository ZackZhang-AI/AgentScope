"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { diagnoseRun } from "@/lib/agentscope/diagnostics/diagnose-run";
import type { RunProjection, TraceEvent } from "@/lib/agentscope/domain";
import type {
  CodeFixRunRequest,
  CodeFixRunResult,
  RecordedCodeFixDemo,
} from "@/lib/agentscope/execution";
import { consumeRunStream } from "@/lib/client/run-stream";
import type { AgentScopeCapabilities } from "./code-fix-launcher";

type SessionMode = "recorded" | "sandbox";

type UseCodeFixSessionOptions = {
  initialRunId?: string;
  autoLoadDemo?: boolean;
  initialRecordedChild?: boolean;
};

type RecordedNavigationOptions = {
  navigate?: boolean;
};

function appendEvent(events: TraceEvent[], event: TraceEvent) {
  if (events.some((candidate) => candidate.eventId === event.eventId)) {
    return events;
  }
  return [...events, event].sort(
    (left, right) => left.sequence - right.sequence,
  );
}

async function fetchStoredRun(runId: string, failureMessage: string) {
  const [runResponse, eventsResponse] = await Promise.all([
    fetch(`/api/v1/runs/${encodeURIComponent(runId)}`),
    fetch(`/api/v1/runs/${encodeURIComponent(runId)}/events?after=0`),
  ]);
  if (!runResponse.ok || !eventsResponse.ok) {
    throw new Error(failureMessage);
  }
  const runPayload = await runResponse.json() as { trace: RunProjection };
  const eventPayload = await eventsResponse.json() as { events: TraceEvent[] };
  return { projection: runPayload.trace, events: eventPayload.events };
}

export function useCodeFixSession({
  initialRunId,
  autoLoadDemo = false,
  initialRecordedChild = false,
}: UseCodeFixSessionOptions = {}) {
  const { localizedPath, t } = useI18n();
  const [capabilities, setCapabilities] = useState<AgentScopeCapabilities>();
  const [provider, setProvider] =
    useState<CodeFixRunRequest["decisionProvider"]>("fixture");
  const [activeResult, setActiveResult] = useState<CodeFixRunResult>();
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [parentProjection, setParentProjection] = useState<RunProjection>();
  const [demo, setDemo] = useState<RecordedCodeFixDemo>();
  const [mode, setMode] = useState<SessionMode>("recorded");
  const [busy, setBusy] = useState(autoLoadDemo || Boolean(initialRunId));
  const [error, setError] = useState<string>();

  const setRecordedParent = useCallback((payload: RecordedCodeFixDemo) => {
    setDemo(payload);
    setMode("recorded");
    setProvider("fixture");
    setParentProjection(undefined);
    setActiveResult(payload.parent.result);
    setEvents(payload.parent.events);
  }, []);

  const loadRecordedDemo = useCallback(async (
    options: RecordedNavigationOptions = {},
  ) => {
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch("/api/v1/code-fix-demo");
      if (!response.ok) throw new Error(t("workbench.recordedDemoError"));
      const payload = await response.json() as RecordedCodeFixDemo;
      setRecordedParent(payload);
      if (options.navigate) {
        window.history.replaceState(
          null,
          "",
          localizedPath("/demos/code-fix-loop"),
        );
      }
      return payload;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("workbench.demoLoadError"));
      return undefined;
    } finally {
      setBusy(false);
    }
  }, [localizedPath, setRecordedParent, t]);

  useEffect(() => {
    void fetch("/api/v1/system/capabilities")
      .then((response) => response.json())
      .then((value: AgentScopeCapabilities) => setCapabilities(value))
      .catch(() => setCapabilities(undefined));
  }, []);

  useEffect(() => {
    if (!autoLoadDemo) return;
    let cancelled = false;
    void fetch("/api/v1/code-fix-demo")
      .then((response) => {
        if (!response.ok) throw new Error(t("workbench.recordedDemoError"));
        return response.json() as Promise<RecordedCodeFixDemo>;
      })
      .then((payload) => {
        if (cancelled) return;
        if (initialRecordedChild) {
          setDemo(payload);
          setMode("recorded");
          setProvider("fixture");
          setParentProjection(payload.parent.result.trace);
          setActiveResult(payload.child.result);
          setEvents(payload.child.events);
        } else {
          setRecordedParent(payload);
        }
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : t("workbench.demoLoadError"));
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [autoLoadDemo, initialRecordedChild, setRecordedParent, t]);

  useEffect(() => {
    if (!initialRunId) return;
    let cancelled = false;
    fetchStoredRun(initialRunId, t("workbench.persistedRunError"))
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
          const parent = await fetchStoredRun(
            projection.run.parentRunId,
            t("workbench.persistedRunError"),
          );
          if (!cancelled) setParentProjection(parent.projection);
        }
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : t("workbench.runLoadError"));
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialRunId, t]);

  async function consumeExecution(response: Response) {
    if (!response.ok) {
      const payload = response.headers
        .get("content-type")
        ?.includes("application/json")
        ? await response.json() as { error?: string }
        : undefined;
      throw new Error(
        payload?.error ?? t("workbench.executionHttpError", { status: response.status }),
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
          localizedPath(`/runs/${encodeURIComponent(message.result.id)}`),
        );
      } else if (message.type === "error") {
        setError(message.error);
      }
    });
    if (!result) throw new Error(t("workbench.missingResult"));
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
      setError(reason instanceof Error ? reason.message : t("workbench.sandboxError"));
    } finally {
      setBusy(false);
    }
  }

  function showRecordedChild(options: RecordedNavigationOptions = {}) {
    if (!demo) return false;
    setParentProjection(demo.parent.result.trace);
    setActiveResult(demo.child.result);
    setEvents(demo.child.events);
    if (options.navigate) {
      window.history.replaceState(
        null,
        "",
        localizedPath("/demos/code-fix-loop?step=verified"),
      );
    }
    return true;
  }

  function resetRecordedParent(options: RecordedNavigationOptions = {}) {
    if (!demo) return false;
    setRecordedParent(demo);
    if (options.navigate) {
      window.history.replaceState(
        null,
        "",
        localizedPath("/demos/code-fix-loop"),
      );
    }
    return true;
  }

  async function forkFromSpan(
    spanId: string,
    options: RecordedNavigationOptions = { navigate: true },
  ) {
    if (!activeResult) return false;
    setBusy(true);
    setError(undefined);
    const parent = activeResult.trace;
    try {
      if (mode === "recorded") {
        if (!demo || demo.child.result.trace.run.forkedFromSpanId !== spanId) {
          throw new Error(t("workbench.recordedBranchError"));
        }
        setParentProjection(parent);
        setActiveResult(demo.child.result);
        setEvents(demo.child.events);
        if (options.navigate) {
          window.history.replaceState(
            null,
            "",
            localizedPath("/demos/code-fix-loop?step=verified"),
          );
        }
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
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("workbench.forkError"));
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

  return {
    activeResult,
    busy,
    capabilities,
    demo,
    diagnostics,
    error,
    events,
    firstFailureSpanId,
    forkFromSpan,
    isVerified,
    loadRecordedDemo,
    mode,
    noProgressDiagnostic,
    parentProjection,
    projection,
    provider,
    providerLabel,
    resetRecordedParent,
    runSandbox,
    setProvider,
    showRecordedChild,
  };
}
