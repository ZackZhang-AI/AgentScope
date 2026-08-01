import {
  AlertCircle,
  Clock3,
  Coins,
  CopyCheck,
  FileWarning,
  RotateCw,
} from "lucide-react";
import type { Diagnostic } from "@/lib/agentscope/diagnostics/diagnose-run";

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
  if (diagnostics.length === 0) {
    return (
      <div className="border-t border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
        Diagnostics: no deterministic issue detected.
      </div>
    );
  }

  return (
    <div className="border-t border-zinc-200 bg-zinc-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold text-zinc-900">Diagnostics</h3>
        <span className="font-mono text-[10px] text-zinc-500">
          {diagnostics.length} findings
        </span>
      </div>
      <div className="grid gap-px overflow-hidden rounded-md border border-zinc-200 bg-zinc-200 lg:grid-cols-2 2xl:grid-cols-4">
        {diagnostics.map((diagnostic) => {
          const Icon = categoryIcon[diagnostic.category];
          const spanId = diagnostic.evidenceSpanIds[0];

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
                  {diagnostic.title}
                </span>
                <span className="mt-1 line-clamp-2 block text-[11px] leading-4 text-zinc-500">
                  {diagnostic.explanation}
                </span>
                <span className="mt-1.5 block font-mono text-[10px] text-zinc-600">
                  confidence {Math.round(diagnostic.confidence * 100)}%
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
