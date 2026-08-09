import {
  AlertCircle,
  Clock3,
  Coins,
  CopyCheck,
  FileWarning,
  RotateCw,
} from "lucide-react";
import type { Diagnostic } from "@/lib/agentscope/diagnostics/diagnose-run";
import { useI18n } from "@/components/i18n-provider";

type DiagnosticsPanelProps = {
  diagnostics: Diagnostic[];
  onSelectSpan: (spanId: string) => void;
};

const categoryIcon = {
  error: AlertCircle,
  retry: RotateCw,
  loop: CopyCheck,
  latency: Clock3,
  token: Coins,
  data_quality: FileWarning,
};

export function DiagnosticsPanel({ diagnostics, onSelectSpan }: DiagnosticsPanelProps) {
  const { locale, t } = useI18n();
  if (diagnostics.length === 0) {
    return (
      <div className="border-t border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
        {t("diagnostics.none")}
      </div>
    );
  }

  return (
    <div className="border-t border-zinc-200 bg-zinc-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold text-zinc-900">{t("diagnostics.title")}</h3>
        <span className="font-mono text-[10px] text-zinc-500">
          {t("diagnostics.findings", { count: diagnostics.length })}
        </span>
      </div>
      <div className="grid gap-px overflow-hidden rounded-md border border-zinc-200 bg-zinc-200 lg:grid-cols-2 2xl:grid-cols-4">
        {diagnostics.map((diagnostic) => {
          const Icon = categoryIcon[diagnostic.category];
          const spanId = diagnostic.evidenceSpanIds[0];
          const localized = locale === "zh" ? (() => {
            switch (diagnostic.ruleId) {
              case "first-unrecovered-error":
                return [t("diagnostics.firstErrorTitle"), t("diagnostics.firstErrorExplanation")];
              case "duplicate-tool-call":
                return [
                  t("diagnostics.duplicateTitle", { count: diagnostic.evidenceSpanIds.length }),
                  t("diagnostics.duplicateExplanation"),
                ];
              case "no-progress-loop":
                return [t("diagnostics.noProgressTitle"), t("diagnostics.noProgressExplanation")];
              case "latency-hotspot":
                return [t("diagnostics.latencyTitle"), t("diagnostics.latencyExplanation")];
              case "token-hotspot":
                return [t("diagnostics.tokenTitle"), t("diagnostics.tokenExplanation")];
              default:
                return [t("diagnostics.qualityTitle"), t("diagnostics.qualityExplanation")];
            }
          })() : [diagnostic.title, diagnostic.explanation];

          return (
            <button
              key={diagnostic.id}
              type="button"
              disabled={!spanId}
              onClick={() => spanId && onSelectSpan(spanId)}
              className="flex min-w-0 gap-2 bg-white p-3 text-left hover:bg-zinc-50 disabled:cursor-default"
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${
                diagnostic.severity === "error"
                  ? "text-red-600"
                  : diagnostic.severity === "warning"
                    ? "text-amber-600"
                    : "text-zinc-500"
              }`} aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-zinc-900">
                  {localized[0]}
                </span>
                <span className="mt-1 line-clamp-2 block text-[11px] leading-4 text-zinc-500">
                  {localized[1]}
                </span>
                <span className="mt-1.5 block font-mono text-[10px] text-zinc-600">
                  {t("diagnostics.confidence", { value: Math.round(diagnostic.confidence * 100) })} · {diagnostic.ruleId === "no-progress-loop" ? "no_progress_loop" : diagnostic.ruleId}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
