"use client";

import { AlertTriangle, ShieldAlert } from "lucide-react";
import type { AuditResponse } from "@/lib/types";
import { EvalCardView } from "./eval-card";
import { ExportButtons } from "./export-buttons";
import { useI18n } from "@/components/i18n-provider";

type FindingsPanelProps = {
  result: AuditResponse | null;
};

export function FindingsPanel({ result }: FindingsPanelProps) {
  const { t } = useI18n();
  const riskScore = result?.riskScore ?? 0;
  const findings = result?.findings ?? [];
  const riskLabel = riskScore >= 80
    ? t("audit.riskCritical")
    : riskScore >= 60
      ? t("audit.riskHigh")
      : riskScore >= 40
        ? t("audit.riskMedium")
        : riskScore >= 20
          ? t("audit.riskLow")
          : t("audit.riskInfo");

  return (
    <aside className="flex min-h-0 flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4">
      <div className="rounded-lg border border-zinc-200 bg-zinc-950 p-4 text-white">
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-200">
          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
          {t("audit.verdict")}
        </div>
        <div className="mt-4 grid gap-3">
          <div>
            <p className="text-xs uppercase text-zinc-400">{t("audit.riskScore")}</p>
            <p className="mt-1 text-3xl font-semibold">{riskScore}</p>
          </div>
          <div className="grid gap-1 text-sm leading-6">
            <p>
              {t("audit.risk")}: <span className="font-semibold text-emerald-200">{riskLabel}</span>
            </p>
            <p>
              {t("audit.confidence")}: <span className="font-semibold text-emerald-200">{result?.evalCard.confidence ?? 0}%</span>
            </p>
            <p>{t("audit.mainConcern")}: {findings[0]?.title ?? t("audit.noConcern")}</p>
            <p>{t("audit.recommendedAction")}: {findings[0]?.recommendation ?? t("audit.runForRecommendation")}</p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-zinc-950">{t("audit.findings")}</h2>
        <div className="mt-3 grid gap-3">
          {findings.length ? (
            findings.map((finding, index) => (
              <article key={`${finding.title}-${index}`} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-zinc-950">{finding.title}</h3>
                      <span className="rounded-md bg-white px-2 py-1 text-xs font-medium capitalize text-zinc-700 ring-1 ring-zinc-200">
                        {finding.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-zinc-700">{finding.evidence}</p>
                    <p className="mt-2 text-sm leading-6 text-zinc-800">
                      <span className="font-medium">{t("audit.fix")}:</span> {finding.recommendation}
                    </p>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <p className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">
              {t("audit.findingsEmpty")}
            </p>
          )}
        </div>
      </div>

      <EvalCardView evalCard={result?.evalCard ?? null} />
      {result ? (
        <section>
          <h2 className="text-sm font-semibold text-zinc-950">{t("audit.runMetrics")}</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm">
            <dt className="text-zinc-500">Provider</dt>
            <dd className="truncate text-right font-medium text-zinc-900">
              {result.model ?? result.provider}
            </dd>
            <dt className="text-zinc-500">{t("audit.latency")}</dt>
            <dd className="text-right font-mono text-zinc-900">
              {result.metrics.providerLatencyMs} ms
            </dd>
            <dt className="text-zinc-500">Prompt</dt>
            <dd className="text-right font-mono text-zinc-900">
              {result.metrics.promptVersion}
            </dd>
            <dt className="text-zinc-500">Tokens</dt>
            <dd className="text-right font-mono text-zinc-900">
              {result.metrics.tokenUsage?.totalTokens ?? "n/a"}
            </dd>
          </dl>
        </section>
      ) : null}
      <ExportButtons result={result} />
    </aside>
  );
}
