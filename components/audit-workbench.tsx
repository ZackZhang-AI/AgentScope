"use client";

import { useEffect, useRef, useState } from "react";
import { AppHeader } from "./app-header";
import { FindingsPanel } from "./findings-panel";
import { InputPanel } from "./input-panel";
import { ReportPreview } from "./report-preview";
import { SessionHistory } from "./session-history";
import { TraceExplorer } from "./agentscope/trace-explorer";
import { sampleList } from "@/lib/samples";
import { consumeAuditStream } from "@/lib/client/audit-stream";
import { clearSessions, loadSessions, saveSession } from "@/lib/storage";
import type { TraceEvent } from "@/lib/agentscope/domain/event";
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

  async function runAudit() {
    setIsRunning(true);
    setError(null);
    setResult(null);
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
      await consumeAuditStream(response, (message) => {
        if (message.type === "trace_event") {
          setTraceEvents((current) => {
            if (current.some((event) => event.eventId === message.event.eventId)) {
              return current;
            }
            return [...current, message.event].sort((left, right) => left.sequence - right.sequence);
          });
        }

        if (message.type === "result") {
          setResult(message.result);
          saveSession(message.result);
          setSessions(loadSessions());
        }

        if (message.type === "error") {
          streamError = message.error;
        }
      });

      if (streamError) throw new Error(streamError);
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

      await consumeAuditStream(response, (message) => {
        if (message.type === "trace_event") {
          setTraceEvents((current) => {
            if (current.some((event) => event.eventId === message.event.eventId)) {
              return current;
            }
            return [...current, message.event].sort((left, right) => left.sequence - right.sequence);
          });
        }

        if (message.type === "result") {
          childResult = message.result;
          setResult(message.result);
          saveSession(message.result);
          setSessions(loadSessions());
        }

        if (message.type === "error") streamError = message.error;
      });

      if (streamError) throw new Error(streamError);
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
    setTraceEvents([]);
    setError(null);
  }

  function clearHistory() {
    clearSessions();
    setSessions([]);
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
