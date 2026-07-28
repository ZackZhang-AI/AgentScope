"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Bot,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Circle,
  FastForward,
  GitBranch,
  Hammer,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  SkipBack,
  SkipForward,
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
} from "@/lib/agentscope/presentation/trace-view";
import { SpanInspector } from "./span-inspector";

type TraceExplorerProps = {
  events: TraceEvent[];
  projection: RunProjection | null;
  isRunning: boolean;
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

export function TraceExplorer({ events, projection, isRunning }: TraceExplorerProps) {
  const [cursor, setCursor] = useState<number | null>(null);
  const [selectedSpanId, setSelectedSpanId] = useState<string>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

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
    () => flattenSpanTree(visibleProjection?.spans ?? []),
    [visibleProjection?.spans],
  );
  const bounds = useMemo(
    () => getTraceBounds(visibleProjection?.spans ?? []),
    [visibleProjection?.spans],
  );
  const selectedSpan = visibleProjection?.spans.find((span) => span.id === selectedSpanId)
    ?? visibleProjection?.spans[0];

  const currentEvent = displayCursor > 0 ? events[displayCursor - 1] : undefined;
  const run = visibleProjection?.run ?? projection?.run;
  const canReplay = events.length > 1;

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
        </div>
      </header>

      {rows.length === 0 ? (
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
        <div className="grid min-h-[520px] xl:grid-cols-[minmax(510px,1fr)_300px]">
          <div className="min-w-0 overflow-x-auto">
            <div className="min-w-[720px]">
              <div className="grid grid-cols-[300px_minmax(340px,1fr)_70px] border-b border-zinc-200 bg-zinc-50 text-[10px] font-medium text-zinc-500">
                <div className="px-3 py-2">Execution path</div>
                <div className="border-l border-zinc-200 px-3 py-2">Relative timeline</div>
                <div className="border-l border-zinc-200 px-2 py-2 text-right">Duration</div>
              </div>
              <div role="tree" aria-label="Trace span tree">
                {rows.map(({ span, depth }) => {
                  const Icon = kindIcon[span.kind];
                  const bar = getTimelineBar(span, bounds);
                  const isSelected = selectedSpan?.id === span.id;

                  return (
                    <button
                      key={span.id}
                      type="button"
                      role="treeitem"
                      aria-level={depth + 1}
                      aria-selected={isSelected}
                      onClick={() => setSelectedSpanId(span.id)}
                      className={`grid w-full grid-cols-[300px_minmax(340px,1fr)_70px] border-b border-zinc-100 text-left last:border-b-0 ${
                        isSelected ? "bg-emerald-50/70" : "bg-white hover:bg-zinc-50"
                      }`}
                    >
                      <div className="flex min-w-0 items-center py-2 pr-2" style={{ paddingLeft: `${12 + depth * 18}px` }}>
                        {depth > 0 ? <ChevronRight className="mr-1 h-3 w-3 shrink-0 text-zinc-400" aria-hidden="true" /> : null}
                        <Icon className="mr-2 h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-medium text-zinc-900">{span.name}</span>
                          <span className="block font-mono text-[10px] text-zinc-500">{span.kind}</span>
                        </span>
                        {span.status === "error" ? <AlertCircle className="ml-auto h-3.5 w-3.5 shrink-0 text-red-600" aria-hidden="true" /> : null}
                      </div>
                      <div className="relative border-l border-zinc-100 px-3 py-2">
                        <div className="absolute inset-y-0 left-1/4 border-l border-dashed border-zinc-100" />
                        <div className="absolute inset-y-0 left-2/4 border-l border-dashed border-zinc-100" />
                        <div className="absolute inset-y-0 left-3/4 border-l border-dashed border-zinc-100" />
                        <div
                          className={`relative mt-2 h-2 min-w-1 rounded-sm ${statusStyle(span.status)}`}
                          style={{ marginLeft: `${bar.offsetPercent}%`, width: `${Math.min(bar.widthPercent, 100 - bar.offsetPercent)}%` }}
                          title={`${span.name}: ${formatDuration(bar.durationMs)}`}
                        />
                      </div>
                      <div className="border-l border-zinc-100 px-2 py-3 text-right font-mono text-[10px] text-zinc-600">
                        {formatDuration(span.metrics?.durationMs ?? bar.durationMs)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <SpanInspector
            span={selectedSpan}
            artifacts={visibleProjection?.artifacts ?? []}
            checkpoints={visibleProjection?.checkpoints ?? []}
          />
        </div>
      )}
    </section>
  );
}
