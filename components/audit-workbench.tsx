"use client";

import { useEffect, useRef, useState } from "react";
import { AppHeader } from "./app-header";
import { FindingsPanel } from "./findings-panel";
import { InputPanel } from "./input-panel";
import { ReportPreview } from "./report-preview";
import { SessionHistory } from "./session-history";
import { TraceExplorer } from "./agentscope/trace-explorer";
import { DemoRunLibrary } from "./agentscope/demo-run-library";
import { sampleList } from "@/lib/samples";
import {
  consumeAuditStream,
  resumeTraceEvents,
} from "@/lib/client/audit-stream";
import { clearSessions, loadSessions, saveSession } from "@/lib/storage";
import type { TraceEvent } from "@/lib/agentscope/domain/event";
import type { DemoRun } from "@/lib/agentscope/fixtures/catalog";
import type {
  AuditRequest,
  AuditResponse,
  AuditRule,
  InputType,
  Intensity,
  Provider,
} from "@/lib/types";

const defaultRules: AuditRule[] = [
  "security",
  "reliability",
  "testing",
  "maintainability",
];

export function AuditWorkbench() {
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
  const [comparisonParent, setComparisonParent] = useState<AuditResponse | null>(null);
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
        throw new Error(payload.error ?? "Audit request failed.");
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
            `Connection interrupted. Trace ${activeRunId} was recovered through event ${recovery.lastSequence}, but the final report response was not delivered.`,
          );
        }
      }
      if (transportError) throw transportError;
      if (!resultReceived) {
        throw new Error("Audit stream completed without a result.");
      }
    } catch (auditError) {
      const message = auditError instanceof Error ? auditError.message : "Audit request failed.";
      setError(message);
    } finally {
      setIsRunning(false);
    }
  }

  async function forkFromSpan(spanId: string) {
    if (!result) return false;

    setIsForking(true);
    setError(null);
    const parent = result;

    try {
      if (activeDemo) {
        const response = await fetch("/api/v1/demo-runs");
        if (!response.ok) throw new Error("Demo catalog could not be loaded.");
        const payload = await response.json() as { runs: DemoRun[] };
        const child = payload.runs.find(
          (demo) =>
            demo.result.trace.run.parentRunId === parent.id &&
            demo.result.trace.run.forkedFromSpanId === spanId,
        );
        if (!child) {
          throw new Error("No fixed fixture branch exists for this checkpoint.");
        }

        setTraceEvents(child.events);
        setResult(child.result);
        setComparisonParent(parent);
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
        throw new Error(payload.error ?? "Fork request failed.");
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
            setComparisonParent(parent);
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
            `Connection interrupted. Child trace ${activeRunId} was recovered through event ${recovery.lastSequence}, but the final report response was not delivered.`,
          );
        }
      }
      if (transportError) throw transportError;
      if (!childResult) throw new Error("Fork stream completed without a child run.");
      return true;
    } catch (forkError) {
      setError(
        forkError instanceof Error ? forkError.message : "Fork request failed.",
      );
      return false;
    } finally {
      setIsForking(false);
    }
  }

  function restoreSession(session: AuditResponse) {
    setResult(session);
    setActiveDemo(null);
    setComparisonParent(
      session.trace.run.parentRunId
        ? sessions.find((candidate) => candidate.id === session.trace.run.parentRunId) ?? null
        : null,
    );
    setTraceEvents([]);
    setProvider(session.provider);
    setInputType(session.inputMeta.inputType);
    setIntensity(session.inputMeta.intensity);
    setRules(session.inputMeta.rules ?? defaultRules);
    setSource(session.inputMeta.source ?? { kind: "pasted" });
    setError(null);
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
      if (!response.ok) throw new Error(payload.error ?? "Pull request import failed.");

      setContent(payload.content);
      setInputType("diff");
      setSource(payload.source);
      setResult(null);
      setComparisonParent(null);
      setActiveDemo(null);
      setTraceEvents([]);
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Pull request import failed.",
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
    setTraceEvents(run.events);
    setComparisonParent(parent?.result ?? null);
    setActiveDemo(run);
    setProvider("mock");
    setError(null);
    saveSession(run.result);
    if (parent) saveSession(parent.result);
    setSessions(loadSessions());
  }

  return (
    <main
      ref={mainRef}
      className="min-h-[100dvh] bg-zinc-100"
      data-hydrated="false"
    >
      <AppHeader provider={provider} />
      <div className="mx-auto grid max-w-[1800px] gap-4 p-4 lg:grid-cols-[340px_minmax(0,1fr)] lg:p-6">
        <div className="grid min-w-0 content-start gap-4">
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
          <SessionHistory sessions={sessions} onRestore={restoreSession} onClear={clearHistory} />
          <DemoRunLibrary onLoad={loadDemoRun} />
        </div>

        <div className="grid content-start gap-4">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900">
              {error}
            </div>
          ) : null}
          <TraceExplorer
            key={result?.id ?? "active-run"}
            events={traceEvents}
            projection={result?.trace ?? null}
            isRunning={isRunning}
            provider={provider}
            isForking={isForking}
            onForkSpan={forkFromSpan}
            parentProjection={comparisonParent?.trace}
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
