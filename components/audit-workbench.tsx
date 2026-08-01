"use client";

import { useEffect, useRef, useState } from "react";
import { AppHeader } from "./app-header";
import { FindingsPanel } from "./findings-panel";
import { InputPanel } from "./input-panel";
import { ReportPreview } from "./report-preview";
import { TraceExplorer } from "./agentscope/trace-explorer";
import { DemoRunLibrary } from "./agentscope/demo-run-library";
import {
  RunManager,
  type RunSelection,
} from "./agentscope/run-manager";
import { sampleList } from "@/lib/samples";
import {
  consumeAuditStream,
  resumeTraceEvents,
} from "@/lib/client/audit-stream";
import { clearSessions, loadSessions, saveSession } from "@/lib/storage";
import type { TraceEvent } from "@/lib/agentscope/domain/event";
import type { RunProjection } from "@/lib/agentscope/domain/projection";
import type { DemoRun } from "@/lib/agentscope/fixtures/catalog";
import type {
  AuditRequest,
  AuditResponse,
  AuditRule,
  InputType,
  Intensity,
  Provider,
} from "@/lib/types";
import { useI18n } from "@/components/i18n-provider";

const defaultRules: AuditRule[] = [
  "security",
  "reliability",
  "testing",
  "maintainability",
];

export function AuditWorkbench() {
  const { t } = useI18n();
  const firstSample = sampleList[0];
  const [content, setContent] = useState(firstSample.content);
  const [inputType, setInputType] = useState<InputType>(firstSample.inputType);
  const [provider, setProvider] = useState<Provider>("mock");
  const [intensity, setIntensity] = useState<Intensity>("standard");
  const [rules, setRules] = useState<AuditRule[]>(defaultRules);
  const [source, setSource] = useState<AuditRequest["source"]>({
    kind: "pasted",
  });
  const [pullRequestUrl, setPullRequestUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<AuditResponse | null>(null);
  const [standaloneProjection, setStandaloneProjection] =
    useState<RunProjection | null>(null);
  const [comparisonParent, setComparisonParent] =
    useState<RunProjection | null>(null);
  const [activeDemo, setActiveDemo] = useState<DemoRun | null>(null);
  const [sessions, setSessions] = useState<AuditResponse[]>([]);
  const [traceEvents, setTraceEvents] = useState<TraceEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isForking, setIsForking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    mainRef.current?.setAttribute("data-hydrated", "true");
    const timeout = window.setTimeout(() => setSessions(loadSessions()), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  function appendTraceEvent(event: TraceEvent) {
    setTraceEvents((current) => {
      if (current.some((candidate) => candidate.eventId === event.eventId)) {
        return current;
      }
      return [...current, event].sort(
        (left, right) => left.sequence - right.sequence,
      );
    });
  }

  async function resumeInterruptedTrace(runId: string, after: number) {
    return resumeTraceEvents({
      runId,
      after,
      onEvent: appendTraceEvent,
    });
  }

  async function runAudit() {
    setIsRunning(true);
    setError(null);
    setResult(null);
    setStandaloneProjection(null);
    setComparisonParent(null);
    setActiveDemo(null);
    setTraceEvents([]);

    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: {
          accept: "text/event-stream",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          content,
          inputType,
          provider,
          intensity,
          rules,
          source,
        }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? t("audit.requestFailed"));
      }

      let streamError: string | null = null;
      let activeRunId: string | undefined;
      let lastSequence = 0;
      let resultReceived = false;
      let transportError: unknown;
      try {
        await consumeAuditStream(response, (message) => {
          if (message.type === "trace_event") {
            activeRunId = message.event.runId;
            lastSequence = Math.max(lastSequence, message.event.sequence);
            appendTraceEvent(message.event);
          }

          if (message.type === "result") {
            resultReceived = true;
            setResult(message.result);
            setStandaloneProjection(null);
            setComparisonParent(null);
            setActiveDemo(null);
            saveSession(message.result);
            setSessions(loadSessions());
          }

          if (message.type === "error") {
            streamError = message.error;
          }
        });
      } catch (streamFailure) {
        transportError = streamFailure;
      }

      if (streamError) throw new Error(streamError);
      if (
        !resultReceived &&
        activeRunId &&
        response.headers.get("x-agentscope-resumable") === "true"
      ) {
        const recovery = await resumeInterruptedTrace(activeRunId, lastSequence);
        if (recovery.status === "terminal") {
          throw new Error(
            t("audit.recoveredNoReport", { runId: activeRunId, sequence: recovery.lastSequence }),
          );
        }
      }
      if (transportError) throw transportError;
      if (!resultReceived) {
        throw new Error(t("audit.noResult"));
      }
    } catch (auditError) {
      const message = auditError instanceof Error ? auditError.message : t("audit.requestFailed");
      setError(message);
    } finally {
      setIsRunning(false);
    }
  }

  async function forkFromSpan(spanId: string) {
    if (!result) {
      setError(
        t("audit.missingForkRequest"),
      );
      return false;
    }

    setIsForking(true);
    setError(null);
    const parent = result;

    try {
      if (activeDemo) {
        const response = await fetch("/api/v1/demo-runs");
        if (!response.ok) throw new Error(t("library.loadError"));
        const payload = await response.json() as { runs: DemoRun[] };
        const child = payload.runs.find(
          (demo) =>
            demo.result.trace.run.parentRunId === parent.id &&
            demo.result.trace.run.forkedFromSpanId === spanId,
        );
        if (!child) {
          throw new Error(t("audit.noFixtureBranch"));
        }

        setTraceEvents(child.events);
        setResult(child.result);
        setStandaloneProjection(null);
        setComparisonParent(parent.trace);
        setActiveDemo(child);
        saveSession(parent);
        saveSession(child.result);
        setSessions(loadSessions());
        return true;
      }

      const response = await fetch(`/api/v1/runs/${encodeURIComponent(parent.id)}/fork`, {
        method: "POST",
        headers: {
          accept: "text/event-stream",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          targetSpanId: spanId,
          parentProjection: parent.trace,
          request: {
            content,
            inputType,
            provider,
            intensity,
            rules,
            source,
          },
        }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? t("audit.forkFailed"));
      }

      setTraceEvents([]);
      let childResult: AuditResponse | null = null;
      let streamError: string | null = null;
      let activeRunId: string | undefined;
      let lastSequence = 0;
      let transportError: unknown;

      try {
        await consumeAuditStream(response, (message) => {
          if (message.type === "trace_event") {
            activeRunId = message.event.runId;
            lastSequence = Math.max(lastSequence, message.event.sequence);
            appendTraceEvent(message.event);
          }

          if (message.type === "result") {
            childResult = message.result;
            setStandaloneProjection(null);
            setComparisonParent(parent.trace);
            setResult(message.result);
            saveSession(message.result);
            setSessions(loadSessions());
          }

          if (message.type === "error") streamError = message.error;
        });
      } catch (streamFailure) {
        transportError = streamFailure;
      }

      if (streamError) throw new Error(streamError);
      if (
        !childResult &&
        activeRunId &&
        response.headers.get("x-agentscope-resumable") === "true"
      ) {
        const recovery = await resumeInterruptedTrace(activeRunId, lastSequence);
        if (recovery.status === "terminal") {
          throw new Error(
            t("audit.childRecoveredNoReport", { runId: activeRunId, sequence: recovery.lastSequence }),
          );
        }
      }
      if (transportError) throw transportError;
      if (!childResult) throw new Error(t("audit.noChildResult"));
      return true;
    } catch (forkError) {
      setError(
        forkError instanceof Error ? forkError.message : t("audit.forkFailed"),
      );
      return false;
    } finally {
      setIsForking(false);
    }
  }

  async function importPullRequest() {
    setIsImporting(true);
    setError(null);

    try {
      const response = await fetch("/api/github/pr", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: pullRequestUrl }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? t("audit.prImportFailed"));

      setContent(payload.content);
      setInputType("diff");
      setSource(payload.source);
      setResult(null);
      setStandaloneProjection(null);
      setComparisonParent(null);
      setActiveDemo(null);
      setTraceEvents([]);
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : t("audit.prImportFailed"),
      );
    } finally {
      setIsImporting(false);
    }
  }

  function changeContent(value: string) {
    setContent(value);
    setSource({ kind: "pasted" });
  }

  function resetInput() {
    setContent("");
    setSource({ kind: "pasted" });
    setResult(null);
    setStandaloneProjection(null);
    setComparisonParent(null);
    setActiveDemo(null);
    setTraceEvents([]);
    setError(null);
  }

  function clearHistory() {
    clearSessions();
    setSessions([]);
  }

  function loadDemoRun(run: DemoRun, parent?: DemoRun) {
    setResult(run.result);
    setStandaloneProjection(null);
    setTraceEvents(run.events);
    setComparisonParent(parent?.result.trace ?? null);
    setActiveDemo(run);
    setProvider("mock");
    setError(null);
    saveSession(run.result);
    if (parent) saveSession(parent.result);
    setSessions(loadSessions());
  }

  function openManagedRun(selection: RunSelection) {
    setResult(selection.response ?? null);
    setStandaloneProjection(selection.response ? null : selection.projection);
    setTraceEvents(selection.events);
    setComparisonParent(null);
    setActiveDemo(null);
    setError(null);
    if (selection.response) {
      setProvider(selection.response.provider);
      setInputType(selection.response.inputMeta.inputType);
      setIntensity(selection.response.inputMeta.intensity);
      setRules(selection.response.inputMeta.rules ?? defaultRules);
      setSource(selection.response.inputMeta.source ?? { kind: "pasted" });
    }
  }

  function compareManagedRuns(
    baseline: RunSelection,
    candidate: RunSelection,
  ) {
    setComparisonParent(baseline.projection);
    setResult(candidate.response ?? null);
    setStandaloneProjection(
      candidate.response ? null : candidate.projection,
    );
    setTraceEvents(candidate.events);
    setActiveDemo(null);
    setError(null);
  }

  const activeProjection = result?.trace ?? standaloneProjection;

  return (
    <main
      ref={mainRef}
      className="min-h-[100dvh] bg-zinc-100"
      data-hydrated="false"
    >
      <AppHeader provider={provider} />
      <div className="mx-auto grid max-w-[1800px] gap-4 p-4 lg:grid-cols-[340px_minmax(0,1fr)] lg:p-6">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-4">
          <InputPanel
            content={content}
            inputType={inputType}
            provider={provider}
            intensity={intensity}
            rules={rules}
            pullRequestUrl={pullRequestUrl}
            source={source}
            isRunning={isRunning}
            isImporting={isImporting}
            onContentChange={changeContent}
            onInputTypeChange={setInputType}
            onProviderChange={setProvider}
            onIntensityChange={setIntensity}
            onRulesChange={setRules}
            onPullRequestUrlChange={setPullRequestUrl}
            onImportPullRequest={importPullRequest}
            onRun={runAudit}
            onReset={resetInput}
          />
          <DemoRunLibrary onLoad={loadDemoRun} />
          <RunManager
            sessions={sessions}
            currentRunId={activeProjection?.run.id}
            currentSelection={activeProjection ? {
              projection: activeProjection,
              events: traceEvents,
              response: result ?? undefined,
            } : undefined}
            onOpenRun={openManagedRun}
            onCompareRuns={compareManagedRuns}
            onClearLocal={clearHistory}
          />
        </div>

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-4 overflow-hidden">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900">
              {error}
            </div>
          ) : null}
          <TraceExplorer
            key={activeProjection?.run.id ?? "active-run"}
            events={traceEvents}
            projection={activeProjection}
            isRunning={isRunning}
            provider={provider}
            isForking={isForking}
            onForkSpan={forkFromSpan}
            parentProjection={comparisonParent ?? undefined}
            replayMode={activeDemo ? "fixture" : "fork"}
          />
          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <ReportPreview markdown={result?.reportMarkdown} />
            <FindingsPanel result={result} />
          </div>
        </div>
      </div>
    </main>
  );
}
