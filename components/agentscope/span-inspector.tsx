"use client";

import { useState } from "react";
import { AlertTriangle, Copy, Database, RotateCcw } from "lucide-react";
import type { Artifact } from "@/lib/agentscope/domain/artifact";
import type { ReplayCheckpoint } from "@/lib/agentscope/domain/checkpoint";
import type { Span } from "@/lib/agentscope/domain/span";
import { formatDuration, summarizeTokens } from "@/lib/agentscope/presentation/trace-view";

type InspectorTab =
  | "overview"
  | "input"
  | "output"
  | "error"
  | "metrics"
  | "replay"
  | "raw";

type SpanInspectorProps = {
  span?: Span;
  artifacts: Artifact[];
  checkpoints: ReplayCheckpoint[];
  isForking: boolean;
  onRequestFork: (spanId: string) => void;
};

const tabs: { id: InspectorTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "input", label: "Input" },
  { id: "output", label: "Output" },
  { id: "error", label: "Error" },
  { id: "metrics", label: "Metrics" },
  { id: "replay", label: "Replay" },
  { id: "raw", label: "Raw" },
];

function JsonBlock({ value, label }: { value: unknown; label: string }) {
  const text = JSON.stringify(value, null, 2);

  if (value === undefined) {
    return <p className="p-4 text-sm text-zinc-500">No {label.toLowerCase()} captured.</p>;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => void navigator.clipboard.writeText(text)}
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] font-medium text-zinc-300 hover:bg-zinc-800 active:translate-y-px"
        aria-label={`Copy ${label.toLowerCase()}`}
      >
        <Copy className="h-3 w-3" aria-hidden="true" />
        Copy
      </button>
      <pre className="max-h-[420px] overflow-auto bg-zinc-950 p-4 pr-16 font-mono text-xs leading-5 text-zinc-200">
        {text}
      </pre>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border-b border-zinc-200 py-2 last:border-b-0">
      <dt className="text-[11px] font-medium text-zinc-500">{label}</dt>
      <dd className="mt-0.5 break-words font-mono text-xs text-zinc-900">{value}</dd>
    </div>
  );
}

export function SpanInspector({
  span,
  artifacts,
  checkpoints,
  isForking,
  onRequestFork,
}: SpanInspectorProps) {
  const [tab, setTab] = useState<InspectorTab>("overview");

  if (!span) {
    return (
      <aside className="flex min-h-64 items-center justify-center border-l border-zinc-200 bg-white p-6 text-center">
        <div>
          <Database className="mx-auto h-5 w-5 text-zinc-400" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-zinc-800">No span selected</p>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            Select a row to inspect its payload and metrics.
          </p>
        </div>
      </aside>
    );
  }

  const spanArtifacts = artifacts.filter((artifact) => artifact.spanId === span.id);
  const spanCheckpoint = checkpoints.find((checkpoint) => checkpoint.spanId === span.id);
  const tokenCount = summarizeTokens(span);
  const replay = span.replayability;

  function handleTabKey(
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    const next = tabs[nextIndex];
    setTab(next.id);
    document.getElementById(`inspector-tab-${next.id}`)?.focus();
  }

  return (
    <aside className="min-w-0 border-l border-zinc-200 bg-white" aria-label="Span inspector">
      <div className="border-b border-zinc-200 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-950">{span.name}</p>
            <p className="mt-1 truncate font-mono text-[11px] text-zinc-500">{span.id}</p>
          </div>
          <span className="rounded-md bg-zinc-100 px-2 py-1 font-mono text-[10px] text-zinc-600">
            {span.kind}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto border-b border-zinc-200" role="tablist" aria-label="Inspector views">
        <div className="flex min-w-max px-2">
          {tabs.map((item, index) => (
            <button
              key={item.id}
              id={`inspector-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              aria-controls={`inspector-panel-${item.id}`}
              tabIndex={tab === item.id ? 0 : -1}
              onClick={() => setTab(item.id)}
              onKeyDown={(event) => handleTabKey(event, index)}
              className={`border-b-2 px-2.5 py-2 text-xs font-medium ${
                tab === item.id
                  ? "border-emerald-600 text-emerald-800"
                  : "border-transparent text-zinc-500 hover:text-zinc-900"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" ? (
        <div id="inspector-panel-overview" role="tabpanel" aria-labelledby="inspector-tab-overview" className="p-3">
          <dl>
            <Metric label="Status" value={span.status} />
            <Metric label="Started" value={new Date(span.startedAt).toLocaleString()} />
            <Metric label="Ended" value={span.endedAt ? new Date(span.endedAt).toLocaleString() : "Running"} />
            <Metric label="Artifacts" value={spanArtifacts.length} />
          </dl>
        </div>
      ) : null}

      {tab === "input" ? <div id="inspector-panel-input" role="tabpanel" aria-labelledby="inspector-tab-input"><JsonBlock value={span.inputRef} label="Input" /></div> : null}
      {tab === "output" ? <div id="inspector-panel-output" role="tabpanel" aria-labelledby="inspector-tab-output"><JsonBlock value={span.outputRef} label="Output" /></div> : null}
      {tab === "error" ? (
        <div id="inspector-panel-error" role="tabpanel" aria-labelledby="inspector-tab-error">
          {span.error ? (
          <div className="p-3">
            <div className="flex gap-2 border border-red-200 bg-red-50 p-3 text-red-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold">{span.error.type}</p>
                <p className="mt-1 text-xs leading-5">{span.error.message}</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="p-4 text-sm text-zinc-500">No structured error captured.</p>
          )}
        </div>
      ) : null}
      {tab === "metrics" ? (
        <div id="inspector-panel-metrics" role="tabpanel" aria-labelledby="inspector-tab-metrics" className="p-3">
          <dl>
            <Metric label="Duration" value={formatDuration(span.metrics?.durationMs)} />
            <Metric label="Time to first token" value={formatDuration(span.metrics?.timeToFirstTokenMs)} />
            <Metric label="Input tokens" value={span.metrics?.tokenUsage?.inputTokens ?? "Not reported"} />
            <Metric label="Output tokens" value={span.metrics?.tokenUsage?.outputTokens ?? "Not reported"} />
            <Metric label="Total tokens" value={tokenCount || "Not reported"} />
          </dl>
        </div>
      ) : null}
      {tab === "replay" ? (
        <div id="inspector-panel-replay" role="tabpanel" aria-labelledby="inspector-tab-replay" className="p-3">
          <div className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-zinc-500" aria-hidden="true" />
            <h3 className="text-xs font-semibold text-zinc-900">Replay safety</h3>
          </div>
          <p className="mt-2 text-xs leading-5 text-zinc-600">
            {replay?.reason ?? (
              spanCheckpoint
                ? `Checkpoint ${spanCheckpoint.completeness}.`
                : "No replay checkpoint was captured."
            )}
          </p>
          <span className={`mt-2 inline-flex rounded-md px-2 py-1 font-mono text-[10px] ${
            replay?.level === "high"
              ? "bg-emerald-50 text-emerald-800"
              : replay?.level === "blocked"
                ? "bg-red-50 text-red-800"
                : "bg-amber-50 text-amber-800"
          }`}>
            {replay?.level ?? (spanCheckpoint ? "medium" : "blocked")}
          </span>
          {spanCheckpoint ? (
            <p className="mt-2 break-all font-mono text-[10px] text-zinc-500">
              {spanCheckpoint.id} · {spanCheckpoint.completeness}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => onRequestFork(span.id)}
            disabled={isForking}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Fork from this step
          </button>
        </div>
      ) : null}
      {tab === "raw" ? <div id="inspector-panel-raw" role="tabpanel" aria-labelledby="inspector-tab-raw"><JsonBlock value={span} label="Raw span" /></div> : null}
    </aside>
  );
}
