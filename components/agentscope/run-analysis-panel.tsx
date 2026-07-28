"use client";

import { useMemo, useState } from "react";
import { Download, GitCompareArrows, ShieldCheck } from "lucide-react";
import type { RunProjection } from "@/lib/agentscope/domain/projection";
import { compareRuns } from "@/lib/agentscope/compare/compare-runs";
import { evaluateRun, evalReportToMarkdown } from "@/lib/agentscope/eval/evaluate-run";
import { formatDuration } from "@/lib/agentscope/presentation/trace-view";

type RunAnalysisPanelProps = {
  projection: RunProjection;
  parentProjection?: RunProjection;
  onSelectSpan: (spanId: string) => void;
};

function downloadFile(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function Fact({
  label,
  parent,
  child,
}: {
  label: string;
  parent?: string | number;
  child: string | number;
}) {
  return (
    <div className={`grid ${parent === undefined ? "grid-cols-[1fr_auto]" : "grid-cols-[1fr_auto_auto]"} gap-3 border-b border-zinc-100 py-2 last:border-b-0`}>
      <span className="text-xs text-zinc-600">{label}</span>
      {parent !== undefined ? <span className="min-w-16 text-right font-mono text-xs text-zinc-500">{parent}</span> : null}
      <span className="min-w-16 text-right font-mono text-xs font-semibold text-zinc-900">{child}</span>
    </div>
  );
}

export function RunAnalysisPanel({
  projection,
  parentProjection,
  onSelectSpan,
}: RunAnalysisPanelProps) {
  const [tab, setTab] = useState<"compare" | "eval">(parentProjection ? "compare" : "eval");
  const comparison = useMemo(
    () => parentProjection ? compareRuns(parentProjection, projection) : undefined,
    [parentProjection, projection],
  );
  const report = useMemo(() => evaluateRun(projection), [projection]);

  return (
    <section className="border-t border-zinc-200 bg-white" aria-label="Run analysis">
      <div className="flex items-center gap-1 border-b border-zinc-200 bg-zinc-50 px-3">
        {comparison ? (
          <button
            type="button"
            onClick={() => setTab("compare")}
            className={`border-b-2 px-3 py-2 text-xs font-semibold ${
              tab === "compare" ? "border-emerald-600 text-emerald-800" : "border-transparent text-zinc-500"
            }`}
          >
            Run Compare
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setTab("eval")}
          className={`border-b-2 px-3 py-2 text-xs font-semibold ${
            tab === "eval" ? "border-emerald-600 text-emerald-800" : "border-transparent text-zinc-500"
          }`}
        >
          Eval Report
        </button>
      </div>

      {tab === "compare" && comparison ? (
        <div className="grid gap-4 p-3 2xl:grid-cols-[340px_minmax(0,1fr)]">
          <div>
            <div className="flex items-center gap-2">
              <GitCompareArrows className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              <h3 className="text-xs font-semibold text-zinc-900">Parent vs child facts</h3>
            </div>
            <div className="mt-3 border-y border-zinc-200">
              <Fact label="Run status" parent={parentProjection?.run.status} child={projection.run.status} />
              <Fact label="Duration" parent={formatDuration(comparison.parentFacts.durationMs)} child={formatDuration(comparison.childFacts.durationMs)} />
              <Fact label="Errors" parent={comparison.parentFacts.errorCount} child={comparison.childFacts.errorCount} />
              <Fact label="Tool calls" parent={comparison.parentFacts.toolCalls} child={comparison.childFacts.toolCalls} />
              <Fact label="Duplicate calls" parent={comparison.parentFacts.duplicateToolCalls} child={comparison.childFacts.duplicateToolCalls} />
              <Fact label="Final output" parent="baseline" child={comparison.finalOutputChanged ? "changed" : "same"} />
              <Fact label="Alignment" parent={`${comparison.unmatchedSpanCount} unmatched`} child={`${Math.round(comparison.alignmentConfidence * 100)}%`} />
              {comparison.parentFacts.totalTokens !== undefined && comparison.childFacts.totalTokens !== undefined ? (
                <Fact label="Reported tokens" parent={comparison.parentFacts.totalTokens} child={comparison.childFacts.totalTokens} />
              ) : null}
            </div>
            <div className="mt-3">
              <p className="text-[11px] font-semibold text-zinc-700">Factual summary</p>
              <ul className="mt-1 grid gap-1 text-[11px] leading-4 text-zinc-500">
                {comparison.summary.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-semibold text-zinc-900">Aligned execution path</h3>
              <span className="font-mono text-[10px] text-zinc-500">
                {comparison.path.filter((item) => item.status !== "unchanged").length} changed
              </span>
            </div>
            <div className="mt-3 max-h-72 overflow-auto rounded-md border border-zinc-200">
              {comparison.path.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  disabled={!item.childSpan}
                  onClick={() => item.childSpan && onSelectSpan(item.childSpan.id)}
                  className="grid w-full grid-cols-[90px_minmax(0,1fr)_minmax(0,1fr)] gap-2 border-b border-zinc-100 p-2 text-left last:border-b-0 hover:bg-zinc-50 disabled:cursor-default"
                >
                  <span className={`self-start rounded-md px-2 py-1 text-center font-mono text-[10px] ${
                    item.status === "added"
                      ? "bg-emerald-50 text-emerald-800"
                      : item.status === "removed"
                        ? "bg-red-50 text-red-800"
                        : item.status === "changed"
                          ? "bg-amber-50 text-amber-800"
                          : "bg-zinc-100 text-zinc-600"
                  }`}>
                    {item.status}
                  </span>
                  <span className="truncate text-xs text-zinc-500">
                    {item.parentSpan?.name ?? "No parent step"}
                  </span>
                  <span className="truncate text-xs font-medium text-zinc-900">
                    {item.childSpan?.name ?? "No child step"}
                    <span className="ml-2 font-mono text-[9px] text-zinc-400">
                      {Math.round(item.confidence * 100)}%
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "eval" ? (
        <div className="grid gap-4 p-3 2xl:grid-cols-[280px_minmax(0,1fr)_260px]">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              <h3 className="text-xs font-semibold text-zinc-900">Measured facts</h3>
            </div>
            <div className="mt-3 border-y border-zinc-200">
              <Fact label="Status" child={report.measuredFacts.status} />
              <Fact label="Spans" child={report.measuredFacts.spanCount} />
              <Fact label="Errors" child={report.measuredFacts.errorCount} />
              <Fact label="Tool success" child={`${report.measuredFacts.successfulToolCalls}/${report.measuredFacts.toolCalls}`} />
              <Fact label="Duplicate calls" child={report.measuredFacts.duplicateToolCalls} />
              <Fact label="Duration" child={formatDuration(report.measuredFacts.durationMs)} />
              <Fact label="Tokens" child={report.measuredFacts.totalTokens ?? "Not reported"} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-semibold text-zinc-900">Deterministic rule scores</h3>
              <span className="font-mono text-xs font-semibold text-zinc-900">
                {report.overallScore}/100 {report.verdict}
              </span>
            </div>
            <div className="mt-3 grid gap-px overflow-hidden rounded-md border border-zinc-200 bg-zinc-200 sm:grid-cols-2">
              {report.scores.map((score) => (
                <button
                  key={score.id}
                  type="button"
                  disabled={score.evidenceSpanIds.length === 0}
                  onClick={() => score.evidenceSpanIds[0] && onSelectSpan(score.evidenceSpanIds[0])}
                  className="bg-white p-3 text-left hover:bg-zinc-50 disabled:cursor-default"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-zinc-900">{score.label}</span>
                    <span className="font-mono text-sm font-semibold text-zinc-950">{score.score}</span>
                  </span>
                  <span className="mt-1 block text-[11px] leading-4 text-zinc-500">{score.explanation}</span>
                  <span className="mt-2 block font-mono text-[10px] text-emerald-700">deterministic_rule</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-zinc-900">Limitations and export</h3>
            <ul className="mt-3 grid gap-2 text-[11px] leading-4 text-zinc-500">
              {report.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
            </ul>
            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={() => downloadFile(`agentscope-eval-${report.runId}.md`, evalReportToMarkdown(report), "text/markdown")}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Export Eval Markdown
              </button>
              <button
                type="button"
                onClick={() => downloadFile(`agentscope-eval-${report.runId}.json`, JSON.stringify(report, null, 2), "application/json")}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Export Eval JSON
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
