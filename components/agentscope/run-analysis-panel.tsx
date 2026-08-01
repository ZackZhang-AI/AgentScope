"use client";

import { useMemo, useState } from "react";
import { Download, GitCompareArrows, ShieldCheck } from "lucide-react";
import type { RunProjection } from "@/lib/agentscope/domain/projection";
import { compareRuns } from "@/lib/agentscope/compare/compare-runs";
import { evaluateRun, evalReportToMarkdown } from "@/lib/agentscope/eval/evaluate-run";
import { formatDuration } from "@/lib/agentscope/presentation/trace-view";
import { useI18n } from "@/components/i18n-provider";

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
  const { locale, t } = useI18n();
  const [tab, setTab] = useState<"compare" | "eval">(parentProjection ? "compare" : "eval");
  const comparison = useMemo(
    () => parentProjection ? compareRuns(parentProjection, projection) : undefined,
    [parentProjection, projection],
  );
  const report = useMemo(() => evaluateRun(projection), [projection]);
  const localizedOutcomes = useMemo(() => {
    if (!comparison || locale !== "zh") return comparison?.outcomes;
    const resolved: string[] = [];
    const regressed: string[] = [];
    const tradeOffs: string[] = [];
    if (parentProjection?.run.status === "error" && projection.run.status === "success") {
      resolved.push(t("analysis.outcomeCompleted"));
    }
    const errorDelta = comparison.childFacts.errorCount - comparison.parentFacts.errorCount;
    if (errorDelta < 0) resolved.push(t("analysis.outcomeErrorsRemoved", { count: -errorDelta }));
    if (errorDelta > 0) regressed.push(t("analysis.outcomeErrorsAdded", { count: errorDelta }));
    const duplicateDelta = comparison.childFacts.duplicateToolCalls - comparison.parentFacts.duplicateToolCalls;
    if (duplicateDelta < 0) resolved.push(t("analysis.outcomeLoopReduced"));
    if (duplicateDelta > 0) regressed.push(t("analysis.outcomeLoopAdded"));
    const durationDelta = comparison.childFacts.durationMs - comparison.parentFacts.durationMs;
    if (durationDelta > 0) tradeOffs.push(t("analysis.outcomeRuntime", { value: durationDelta }));
    if (comparison.parentFacts.totalTokens !== undefined && comparison.childFacts.totalTokens !== undefined) {
      const tokenDelta = comparison.childFacts.totalTokens - comparison.parentFacts.totalTokens;
      if (tokenDelta > 0) tradeOffs.push(t("analysis.outcomeTokens", { value: tokenDelta }));
    }
    return { resolved, regressed, tradeOffs };
  }, [comparison, locale, parentProjection?.run.status, projection.run.status, t]);

  return (
    <section className="border-t border-zinc-200 bg-white" aria-label={t("analysis.ariaLabel")}>
      <div className="flex items-center gap-1 border-b border-zinc-200 bg-zinc-50 px-3">
        {comparison ? (
          <button
            type="button"
            onClick={() => setTab("compare")}
            className={`border-b-2 px-3 py-2 text-xs font-semibold ${
              tab === "compare" ? "border-emerald-600 text-emerald-800" : "border-transparent text-zinc-500"
            }`}
          >
            {t("analysis.compare")}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setTab("eval")}
          className={`border-b-2 px-3 py-2 text-xs font-semibold ${
            tab === "eval" ? "border-emerald-600 text-emerald-800" : "border-transparent text-zinc-500"
          }`}
        >
          {t("analysis.evalReport")}
          <span className="ml-1 font-mono text-[9px] text-zinc-600">v1</span>
        </button>
      </div>

      {tab === "compare" && comparison ? (
        <div className="grid gap-4 p-3 2xl:grid-cols-[340px_minmax(0,1fr)]">
          <div>
            <div className="flex items-center gap-2">
              <GitCompareArrows className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              <h3 className="text-xs font-semibold text-zinc-900">{t("analysis.parentChildFacts")}</h3>
            </div>
            <div className="mt-3 border-y border-zinc-200">
              <Fact label={t("analysis.runStatus")} parent={parentProjection?.run.status} child={projection.run.status} />
              <Fact label={t("analysis.duration")} parent={formatDuration(comparison.parentFacts.durationMs)} child={formatDuration(comparison.childFacts.durationMs)} />
              <Fact label={t("analysis.errors")} parent={comparison.parentFacts.errorCount} child={comparison.childFacts.errorCount} />
              <Fact label={t("analysis.toolCalls")} parent={comparison.parentFacts.toolCalls} child={comparison.childFacts.toolCalls} />
              <Fact label={t("analysis.duplicateCalls")} parent={comparison.parentFacts.duplicateToolCalls} child={comparison.childFacts.duplicateToolCalls} />
              <Fact label={t("analysis.finalOutput")} parent={t("analysis.baseline")} child={comparison.finalOutputChanged ? t("analysis.changed") : t("analysis.same")} />
              <Fact label={t("analysis.alignment")} parent={t("analysis.unmatched", { count: comparison.unmatchedSpanCount })} child={`${Math.round(comparison.alignmentConfidence * 100)}%`} />
              {comparison.parentFacts.totalTokens !== undefined && comparison.childFacts.totalTokens !== undefined ? (
                <Fact label={t("analysis.reportedTokens")} parent={comparison.parentFacts.totalTokens} child={comparison.childFacts.totalTokens} />
              ) : null}
            </div>
            <div className="mt-3">
              <p className="text-[11px] font-semibold text-zinc-700">{t("analysis.factualSummary")}</p>
              <ul className="mt-1 grid gap-1 text-[11px] leading-4 text-zinc-500">
                {(locale === "zh" ? [
                  t("analysis.summaryStatus", { parent: parentProjection?.run.status ?? "—", child: projection.run.status }),
                  t("analysis.summaryErrors", { parent: comparison.parentFacts.errorCount, child: comparison.childFacts.errorCount }),
                  t("analysis.summaryCalls", { parent: comparison.parentFacts.toolCalls, child: comparison.childFacts.toolCalls }),
                ] : comparison.summary).map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
            {projection.run.taskType === "code_fix" ? (
              <div className="mt-4 grid gap-3">
                {[
                  {
                    label: t("analysis.resolved"),
                    items: localizedOutcomes?.resolved ?? [],
                    style: "border-emerald-200 bg-emerald-50 text-emerald-900",
                  },
                  {
                    label: t("analysis.regressed"),
                    items: localizedOutcomes?.regressed ?? [],
                    style: "border-red-200 bg-red-50 text-red-900",
                  },
                  {
                    label: t("analysis.tradeOff"),
                    items: localizedOutcomes?.tradeOffs ?? [],
                    style: "border-amber-200 bg-amber-50 text-amber-900",
                  },
                ].map((group) => (
                  <div key={group.label} className={`border p-3 ${group.style}`}>
                    <p className="text-[11px] font-semibold">{group.label}</p>
                    <ul className="mt-1 grid gap-1 text-[11px] leading-4">
                      {(group.items.length > 0
                        ? group.items
                        : [t("analysis.noEvidence")]
                      ).map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="min-w-0">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-semibold text-zinc-900">{t("analysis.alignedPath")}</h3>
              <span className="font-mono text-[10px] text-zinc-500">
                {t("analysis.changedCount", { count: comparison.path.filter((item) => item.status !== "unchanged").length })}
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
                    {item.parentSpan?.name ?? t("analysis.noParentStep")}
                  </span>
                  <span className="truncate text-xs font-medium text-zinc-900">
                    {item.childSpan?.name ?? t("analysis.noChildStep")}
                    <span className="ml-2 font-mono text-[9px] text-zinc-600">
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
              <h3 className="text-xs font-semibold text-zinc-900">{t("analysis.measuredFacts")}</h3>
            </div>
            <div className="mt-3 border-y border-zinc-200">
              <Fact label={t("analysis.status")} child={report.measuredFacts.status} />
              <Fact label={t("analysis.spans")} child={report.measuredFacts.spanCount} />
              <Fact label={t("analysis.errors")} child={report.measuredFacts.errorCount} />
              <Fact label={t("analysis.toolSuccess")} child={`${report.measuredFacts.successfulToolCalls}/${report.measuredFacts.toolCalls}`} />
              <Fact label={t("analysis.duplicateCalls")} child={report.measuredFacts.duplicateToolCalls} />
              <Fact label={t("analysis.duration")} child={formatDuration(report.measuredFacts.durationMs)} />
              <Fact label="Token" child={report.measuredFacts.totalTokens ?? t("analysis.notReported")} />
              {report.measuredFacts.codeFix ? (
                <>
                  <Fact label={t("analysis.targetTests")} child={report.measuredFacts.codeFix.testPassed ? t("analysis.passed") : t("analysis.failed")} />
                  <Fact label={t("analysis.patchCaptured")} child={report.measuredFacts.codeFix.patchCreated ? t("analysis.yes") : t("analysis.no")} />
                  <Fact label={t("analysis.noProgressCalls")} child={report.measuredFacts.codeFix.noProgressCalls} />
                  <Fact label={t("analysis.safetyViolations")} child={report.measuredFacts.codeFix.replaySafetyViolations} />
                </>
              ) : null}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-semibold text-zinc-900">{t("analysis.ruleScores")}</h3>
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
                    <span className="text-xs font-semibold text-zinc-900">{locale === "zh" ? t(`analysis.score.${score.id}`) : score.label}</span>
                    <span className="font-mono text-sm font-semibold text-zinc-950">{score.score}</span>
                  </span>
                  <span className="mt-1 block text-[11px] leading-4 text-zinc-500">{locale === "zh" ? t("analysis.ruleEvidence", { count: score.evidenceSpanIds.length }) : score.explanation}</span>
                  <span className="mt-2 block font-mono text-[10px] text-emerald-700">deterministic_rule</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-zinc-900">{t("analysis.limitationsExport")}</h3>
            <p className="mt-1 font-mono text-[10px] text-zinc-600">
              schema v{report.reportSchemaVersion} · trace seq {report.inputTraceSequence}
            </p>
            <ul className="mt-3 grid gap-2 text-[11px] leading-4 text-zinc-500">
              {(locale === "zh" ? [t("analysis.limitationReasoning"), ...(report.measuredFacts.totalTokens === undefined ? [t("analysis.limitationTokens")] : [])] : report.limitations).map((limitation) => <li key={limitation}>{limitation}</li>)}
            </ul>
            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={() => downloadFile(`agentscope-eval-${report.runId}.md`, evalReportToMarkdown(report), "text/markdown")}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                {t("analysis.exportMarkdown")}
              </button>
              <button
                type="button"
                onClick={() => downloadFile(`agentscope-eval-${report.runId}.json`, JSON.stringify(report, null, 2), "application/json")}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                {t("analysis.exportJson")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
