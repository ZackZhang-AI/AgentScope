"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Bot,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  FastForward,
  GitBranch,
  Hammer,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
  SkipBack,
  SkipForward,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { RunProjection } from "@/lib/agentscope/domain/projection";
import { projectTraceEvents } from "@/lib/agentscope/domain/projection";
import type { Span } from "@/lib/agentscope/domain/span";
import type { TraceEvent } from "@/lib/agentscope/domain/event";
import {
  flattenSpanTree,
  formatDuration,
  getTimelineBar,
  getTraceBounds,
  getTimelineViewportBar,
} from "@/lib/agentscope/presentation/trace-view";
import type { SpanKind, SpanStatus } from "@/lib/agentscope/domain/span";
import { SpanInspector } from "./span-inspector";
import { DiagnosticsPanel } from "./diagnostics-panel";
import { diagnoseRun } from "@/lib/agentscope/diagnostics/diagnose-run";
import { buildReplayPreflight } from "@/lib/agentscope/replay/preflight";
import { ReplayPreflightDialog } from "./replay-preflight-dialog";
import { RunAnalysisPanel } from "./run-analysis-panel";

type TraceExplorerProps = {
  events: TraceEvent[];
  projection: RunProjection | null;
  isRunning: boolean;
  provider: string;
  isForking: boolean;
  onForkSpan: (spanId: string) => Promise<boolean>;
  parentProjection?: RunProjection;
  replayMode: "fixture" | "fork";
};

const kindIcon = {
  agent: Bot,
  plan: GitBranch,
  model: BrainCircuit,
  tool: Hammer,
  handoff: GitBranch,
  guardrail: ShieldCheck,
  eval: CheckCircle2,
  custom: Circle,
};

function statusStyle(status: Span["status"]) {
  if (status === "error") return "bg-red-600";
  if (status === "cancelled" || status === "skipped") return "bg-amber-500";
  if (status === "success") return "bg-emerald-600";
  return "bg-sky-600";
}

function safeProject(events: TraceEvent[]) {
  if (events.length === 0) return null;
  try {
    return projectTraceEvents(events);
  } catch {
    return null;
  }
}

export function TraceExplorer({
  events,
  projection,
  isRunning,
  provider,
  isForking,
  onForkSpan,
  parentProjection,
  replayMode,
}: TraceExplorerProps) {
  const [cursor, setCursor] = useState<number | null>(null);
  const [selectedSpanId, setSelectedSpanId] = useState<string>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [forkTargetId, setForkTargetId] = useState<string>();
  const [collapsedSpanIds, setCollapsedSpanIds] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<SpanKind | "all">("all");
  const [statusFilter, setStatusFilter] = useState<SpanStatus | "all">("all");
  const [keyStepsOnly, setKeyStepsOnly] = useState(false);
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [viewportStart, setViewportStart] = useState(0);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  const displayCursor = cursor ?? events.length;

  useEffect(() => {
    if (!isPlaying || displayCursor >= events.length) return;

    const timeout = window.setTimeout(
      () => {
        const nextCursor = Math.min(events.length, displayCursor + 1);
        setCursor(nextCursor);
        if (nextCursor >= events.length) setIsPlaying(false);
      },
      700 / speed,
    );
    return () => window.clearTimeout(timeout);
  }, [displayCursor, events.length, isPlaying, speed]);

  const visibleProjection = useMemo(
    () => displayCursor === events.length
      ? (safeProject(events) ?? projection)
      : safeProject(events.slice(0, displayCursor)),
    [displayCursor, events, projection],
  );
  const rows = useMemo(
    () => flattenSpanTree(visibleProjection?.spans ?? [], {
      collapsedSpanIds,
      filter: {
        query,
        kind: kindFilter === "all" ? undefined : kindFilter,
        status: statusFilter === "all" ? undefined : statusFilter,
        keyStepsOnly,
      },
    }),
    [
      collapsedSpanIds,
      keyStepsOnly,
      kindFilter,
      query,
      statusFilter,
      visibleProjection?.spans,
    ],
  );
  const bounds = useMemo(
    () => getTraceBounds(visibleProjection?.spans ?? []),
    [visibleProjection?.spans],
  );
  const preferredSpan = visibleProjection?.spans.find(
    (span) => span.status === "error" && span.replayability?.level === "high",
  ) ?? visibleProjection?.spans.find(
    (span) => span.status === "error",
  ) ?? visibleProjection?.spans.find(
    (span) => span.replayability?.level === "high",
  ) ?? visibleProjection?.spans[0];
  const effectiveSelectedSpanId = rows.some((row) => row.span.id === selectedSpanId)
    ? selectedSpanId
    : rows.some((row) => row.span.id === preferredSpan?.id)
      ? preferredSpan?.id
      : rows[0]?.span.id;
  const selectedSpan = visibleProjection?.spans.find((span) => span.id === effectiveSelectedSpanId)
    ?? preferredSpan;
  const diagnostics = useMemo(
    () => visibleProjection ? diagnoseRun(visibleProjection) : [],
    [visibleProjection],
  );

  const currentEvent = displayCursor > 0 ? events[displayCursor - 1] : undefined;
  const run = visibleProjection?.run ?? projection?.run;
  const canReplay = events.length > 1;
  const forkTarget = projection?.spans.find((span) => span.id === forkTargetId);
  const replayPreflight = forkTarget && projection
    ? buildReplayPreflight(projection, forkTarget.id)
    : undefined;
  const maxViewportStart = 100 - 100 / timelineZoom;

  function toggleCollapsed(spanId: string) {
    setCollapsedSpanIds((current) => {
      const next = new Set(current);
      if (next.has(spanId)) next.delete(spanId);
      else next.add(spanId);
      return next;
    });
  }

  function selectAndFocus(spanId: string) {
    setSelectedSpanId(spanId);
    rowRefs.current.get(spanId)?.focus();
  }

  function handleTreeKey(
    event: React.KeyboardEvent<HTMLDivElement>,
    rowIndex: number,
  ) {
    const row = rows[rowIndex];
    if (!row) return;
    const parentId = row.span.parentSpanId;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const offset = event.key === "ArrowDown" ? 1 : -1;
      const target = rows[Math.max(0, Math.min(rows.length - 1, rowIndex + offset))];
      if (target) selectAndFocus(target.span.id);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      if (row.hasChildren && !row.isExpanded) toggleCollapsed(row.span.id);
      else {
        const child = rows[rowIndex + 1];
        if (child?.depth === row.depth + 1) selectAndFocus(child.span.id);
      }
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (row.hasChildren && row.isExpanded) toggleCollapsed(row.span.id);
      else if (parentId) selectAndFocus(parentId);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelectedSpanId(row.span.id);
    }
  }

  return (
    <section className="overflow-hidden rounded-lg border border-zinc-300 bg-white" aria-labelledby="trace-explorer-title">
      <header className="flex flex-col gap-3 border-b border-zinc-200 bg-zinc-50 px-3 py-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="trace-explorer-title" className="text-sm font-semibold text-zinc-950">
              Harness Trace
            </h2>
            {run ? (
              <>
                <span className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 font-mono text-[10px] text-zinc-600">
                  {run.status}
                </span>
                <span className="truncate font-mono text-[10px] text-zinc-500">{run.id}</span>
                {run.parentRunId ? (
                  <span
                    className="max-w-48 truncate rounded-md bg-emerald-50 px-2 py-0.5 font-mono text-[10px] text-emerald-800"
                    title={`Forked from ${run.parentRunId}`}
                  >
                    child of {run.parentRunId}
                  </span>
                ) : null}
              </>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {currentEvent
              ? `Event ${displayCursor}/${events.length}: ${currentEvent.type}`
              : isRunning
                ? "Waiting for the first trace event."
                : "Run an audit to inspect its execution path."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1" aria-label="Visual replay controls">
          <button
            type="button"
            disabled={!canReplay || displayCursor === 0}
            onClick={() => { setIsPlaying(false); setCursor(0); }}
            className="trace-control"
            aria-label="Restart visual replay"
            title="Restart visual replay"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={!canReplay || displayCursor === 0}
            onClick={() => { setIsPlaying(false); setCursor(Math.max(0, displayCursor - 1)); }}
            className="trace-control"
            aria-label="Previous event"
            title="Previous event"
          >
            <SkipBack className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={!canReplay}
            onClick={() => {
              if (displayCursor >= events.length) setCursor(0);
              setIsPlaying((value) => !value);
            }}
            className="trace-control min-w-16"
            aria-label={isPlaying ? "Pause visual replay" : "Play visual replay"}
          >
            {isPlaying ? <Pause className="h-3.5 w-3.5" aria-hidden="true" /> : <Play className="h-3.5 w-3.5" aria-hidden="true" />}
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            disabled={!canReplay || displayCursor >= events.length}
            onClick={() => { setIsPlaying(false); setCursor(Math.min(events.length, displayCursor + 1)); }}
            className="trace-control"
            aria-label="Next event"
            title="Next event"
          >
            <SkipForward className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={!canReplay}
            onClick={() => setSpeed((value) => value === 1 ? 2 : value === 2 ? 0.5 : 1)}
            className="trace-control"
            aria-label={`Replay speed ${speed} times`}
            title="Change replay speed"
          >
            <FastForward className="h-3.5 w-3.5" aria-hidden="true" />
            {speed}x
          </button>
          {canReplay ? (
            <label className="ml-1 flex min-w-40 items-center gap-2 text-[10px] text-zinc-500">
              <span className="sr-only">Seek visual replay event</span>
              <input
                type="range"
                min={0}
                max={events.length}
                value={displayCursor}
                onChange={(event) => {
                  setIsPlaying(false);
                  setCursor(Number(event.target.value));
                }}
                className="w-28 accent-emerald-700"
                aria-label="Seek visual replay event"
              />
              <span className="min-w-10 font-mono">{displayCursor}/{events.length}</span>
            </label>
          ) : null}
        </div>
      </header>

      {(visibleProjection?.spans.length ?? 0) === 0 ? (
        <div className="flex min-h-72 items-center justify-center p-8 text-center">
          <div>
            <GitBranch className="mx-auto h-6 w-6 text-zinc-400" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium text-zinc-800">
              {isRunning ? "Trace is starting" : "No structured trace yet"}
            </p>
            <p className="mt-1 max-w-sm text-xs leading-5 text-zinc-500">
              Agent plans, model calls, tools, errors, latency and tokens will appear here.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2 border-b border-zinc-200 bg-white p-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative">
                <span className="sr-only">Filter trace spans</span>
                <Search className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filter spans"
                  className="h-8 w-44 rounded-md border border-zinc-300 bg-white pl-7 pr-2 text-xs text-zinc-900 placeholder:text-zinc-400"
                />
              </label>
              <label>
                <span className="sr-only">Filter by span kind</span>
                <select
                  value={kindFilter}
                  onChange={(event) => setKindFilter(event.target.value as SpanKind | "all")}
                  className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs text-zinc-700"
                  aria-label="Filter by span kind"
                >
                  <option value="all">All kinds</option>
                  <option value="agent">Agent</option>
                  <option value="plan">Plan</option>
                  <option value="model">Model</option>
                  <option value="tool">Tool</option>
                  <option value="handoff">Handoff</option>
                  <option value="guardrail">Guardrail</option>
                  <option value="eval">Eval</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              <label>
                <span className="sr-only">Filter by span status</span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as SpanStatus | "all")}
                  className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs text-zinc-700"
                  aria-label="Filter by span status"
                >
                  <option value="all">All statuses</option>
                  <option value="running">Running</option>
                  <option value="success">Success</option>
                  <option value="error">Error</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="skipped">Skipped</option>
                </select>
              </label>
              <button
                type="button"
                aria-pressed={keyStepsOnly}
                onClick={() => setKeyStepsOnly((value) => !value)}
                className={`h-8 rounded-md border px-2 text-xs font-medium ${
                  keyStepsOnly
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : "border-zinc-300 bg-white text-zinc-600"
                }`}
              >
                Key steps
              </button>
              <span className="font-mono text-[10px] text-zinc-500">
                {rows.length}/{visibleProjection?.spans.length ?? 0} visible
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1" aria-label="Timeline viewport controls">
              <button
                type="button"
                className="trace-control"
                disabled={timelineZoom === 1}
                onClick={() => {
                  const next = Math.max(1, timelineZoom / 2);
                  setTimelineZoom(next);
                  setViewportStart((value) => Math.min(value, 100 - 100 / next));
                }}
                aria-label="Zoom timeline out"
                title="Zoom timeline out"
              >
                <ZoomOut className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="trace-control"
                disabled={timelineZoom === 4}
                onClick={() => setTimelineZoom((value) => Math.min(4, value * 2))}
                aria-label="Zoom timeline in"
                title="Zoom timeline in"
              >
                <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="trace-control"
                onClick={() => {
                  setTimelineZoom(1);
                  setViewportStart(0);
                }}
                aria-label="Fit entire timeline"
              >
                <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                Fit
              </button>
              {timelineZoom > 1 ? (
                <label className="ml-1 flex items-center gap-2 text-[10px] text-zinc-500">
                  <span>Pan</span>
                  <input
                    type="range"
                    min={0}
                    max={maxViewportStart}
                    step={0.5}
                    value={viewportStart}
                    onChange={(event) => setViewportStart(Number(event.target.value))}
                    className="w-24 accent-emerald-700"
                    aria-label="Pan timeline viewport"
                  />
                </label>
              ) : null}
              <span className="ml-1 font-mono text-[10px] text-zinc-500">{timelineZoom}x</span>
            </div>
          </div>
          {rows.length === 0 ? (
            <div className="flex min-h-64 items-center justify-center border-b border-zinc-200 p-6 text-center">
              <div>
                <Search className="mx-auto h-5 w-5 text-zinc-400" aria-hidden="true" />
                <p className="mt-2 text-sm font-medium text-zinc-800">No spans match these filters</p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setKindFilter("all");
                    setStatusFilter("all");
                    setKeyStepsOnly(false);
                  }}
                  className="mt-3 rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Clear filters
                </button>
              </div>
            </div>
          ) : (
          <div className="grid min-h-[520px] xl:grid-cols-[minmax(510px,1fr)_300px]">
            <div className="min-w-0 overflow-x-auto">
              <div className="min-w-[720px]">
              <div className="grid grid-cols-[300px_minmax(340px,1fr)_70px] border-b border-zinc-200 bg-zinc-50 text-[10px] font-medium text-zinc-500">
                <div className="px-3 py-2">Execution path</div>
                <div className="border-l border-zinc-200 px-3 py-2">Relative timeline</div>
                <div className="border-l border-zinc-200 px-2 py-2 text-right">Duration</div>
              </div>
              <div role="tree" aria-label="Trace span tree">
                {rows.map((row, rowIndex) => {
                  const { span, depth, hasChildren, isExpanded, hasErrorDescendant } = row;
                  const Icon = kindIcon[span.kind];
                  const bar = getTimelineBar(span, bounds);
                  const viewportBar = getTimelineViewportBar(
                    bar,
                    timelineZoom,
                    viewportStart,
                  );
                  const isSelected = selectedSpan?.id === span.id;

                  return (
                    <div
                      key={span.id}
                      role="treeitem"
                      aria-level={depth + 1}
                      aria-selected={isSelected}
                      aria-expanded={hasChildren ? isExpanded : undefined}
                      tabIndex={isSelected ? 0 : -1}
                      ref={(element) => {
                        if (element) rowRefs.current.set(span.id, element);
                        else rowRefs.current.delete(span.id);
                      }}
                      onClick={() => setSelectedSpanId(span.id)}
                      onKeyDown={(event) => handleTreeKey(event, rowIndex)}
                      className={`trace-row grid w-full cursor-pointer grid-cols-[300px_minmax(340px,1fr)_70px] border-b border-zinc-100 text-left outline-none last:border-b-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600 ${
                        isSelected ? "bg-emerald-50/70" : "bg-white hover:bg-zinc-50"
                      }`}
                    >
                      <div className="flex min-w-0 items-center py-2 pr-2" style={{ paddingLeft: `${12 + depth * 18}px` }}>
                        {hasChildren ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleCollapsed(span.id);
                            }}
                            className="mr-1 rounded-sm p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
                            aria-label={`${isExpanded ? "Collapse" : "Expand"} ${span.name}`}
                            tabIndex={-1}
                          >
                            {isExpanded
                              ? <ChevronDown className="h-3 w-3" aria-hidden="true" />
                              : <ChevronRight className="h-3 w-3" aria-hidden="true" />}
                          </button>
                        ) : (
                          <span className="mr-1 h-4 w-4 shrink-0" />
                        )}
                        <Icon className="mr-2 h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-medium text-zinc-900">{span.name}</span>
                          <span className="block font-mono text-[10px] text-zinc-500">
                            {span.kind} / {span.status}
                          </span>
                        </span>
                        {span.status === "error" ? <AlertCircle className="ml-auto h-3.5 w-3.5 shrink-0 text-red-600" aria-hidden="true" /> : null}
                        {span.status !== "error" && hasErrorDescendant ? (
                          <AlertCircle
                            className="ml-auto h-3.5 w-3.5 shrink-0 text-red-500"
                            aria-label="Contains an error descendant"
                          />
                        ) : null}
                      </div>
                      <div className="relative border-l border-zinc-100 px-3 py-2">
                        <div className="absolute inset-y-0 left-1/4 border-l border-dashed border-zinc-100" />
                        <div className="absolute inset-y-0 left-2/4 border-l border-dashed border-zinc-100" />
                        <div className="absolute inset-y-0 left-3/4 border-l border-dashed border-zinc-100" />
                        {viewportBar ? (
                          <div
                            className={`relative mt-2 h-2 min-w-1 rounded-sm ${statusStyle(span.status)}`}
                            style={{
                              marginLeft: `${viewportBar.offsetPercent}%`,
                              width: `${Math.min(viewportBar.widthPercent, 100 - viewportBar.offsetPercent)}%`,
                            }}
                            title={`${span.name}: ${formatDuration(bar.durationMs)}`}
                          />
                        ) : null}
                      </div>
                      <div className="border-l border-zinc-100 px-2 py-3 text-right font-mono text-[10px] text-zinc-600">
                        {formatDuration(span.metrics?.durationMs ?? bar.durationMs)}
                      </div>
                    </div>
                  );
                })}
              </div>
              </div>
            </div>

            <SpanInspector
              span={selectedSpan}
              artifacts={visibleProjection?.artifacts ?? []}
              checkpoints={visibleProjection?.checkpoints ?? []}
              isForking={isForking}
              onRequestFork={setForkTargetId}
            />
          </div>
          )}
          <DiagnosticsPanel diagnostics={diagnostics} onSelectSpan={setSelectedSpanId} />
          {visibleProjection?.run.completedAt ? (
            <RunAnalysisPanel
              projection={visibleProjection}
              parentProjection={parentProjection}
              onSelectSpan={setSelectedSpanId}
            />
          ) : null}
        </>
      )}
      {forkTarget && replayPreflight ? (
        <ReplayPreflightDialog
          target={forkTarget}
          preflight={replayPreflight}
          provider={provider}
          mode={replayMode}
          isSubmitting={isForking}
          onClose={() => setForkTargetId(undefined)}
          onConfirm={() => {
            void onForkSpan(forkTarget.id).then((created) => {
              if (created) setForkTargetId(undefined);
            });
          }}
        />
      ) : null}
    </section>
  );
}
