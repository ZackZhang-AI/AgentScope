"use client";

import { useEffect, useRef, useState } from "react";
import { AppHeader } from "./app-header";
import { FindingsPanel } from "./findings-panel";
import { InputPanel } from "./input-panel";
import { ReportPreview } from "./report-preview";
import { SessionHistory } from "./session-history";
import { TraceTimeline } from "./trace-timeline";
import { sampleList } from "@/lib/samples";
import { consumeAuditStream } from "@/lib/client/audit-stream";
import { clearSessions, loadSessions, saveSession } from "@/lib/storage";
import type {
  AgentEvent,
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
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
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
    setEvents([]);

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
        if (message.type === "trace") {
          setEvents((current) => {
            const next = new Map(current.map((event) => [event.id, event]));
            next.set(message.event.id, message.event);
            return [...next.values()];
          });
        }

        if (message.type === "result") {
          setResult(message.result);
          setEvents(message.result.events);
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
      setEvents([
        {
          id: "inspect",
          stage: "inspect",
          status: "error",
          title: "Audit failed",
          detail: message,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsRunning(false);
    }
  }

  function restoreSession(session: AuditResponse) {
    setResult(session);
    setEvents(session.events);
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
      setEvents([]);
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
    setEvents([]);
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
      <div className="mx-auto grid max-w-[1600px] gap-4 p-4 lg:grid-cols-[360px_minmax(0,1fr)_380px] lg:p-6">
        <div className="grid content-start gap-4">
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
          <TraceTimeline events={events} isRunning={isRunning} />
          <ReportPreview markdown={result?.reportMarkdown} />
        </div>

        <FindingsPanel result={result} />
      </div>
    </main>
  );
}
