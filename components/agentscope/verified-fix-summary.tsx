import Link from "next/link";
import { ArrowRight, RotateCcw } from "lucide-react";
import type { RunProjection } from "@/lib/agentscope/domain";
import { compareRuns } from "@/lib/agentscope/compare/compare-runs";

type VerifiedFixSummaryProps = {
  parent: RunProjection;
  child: RunProjection;
  onRestart: () => void;
};

function signed(value: number, suffix = "") {
  return `${value > 0 ? "+" : ""}${value}${suffix}`;
}

export function VerifiedFixSummary({
  parent,
  child,
  onRestart,
}: VerifiedFixSummaryProps) {
  const comparison = compareRuns(parent, child);
  const parentFacts = comparison.parentFacts;
  const childFacts = comparison.childFacts;
  const tokenDelta = parentFacts.totalTokens !== undefined && childFacts.totalTokens !== undefined
    ? signed(childFacts.totalTokens - parentFacts.totalTokens)
    : "Not reported";

  const facts = [
    { label: "Target test", before: "Failed", after: "Passed", delta: "Verified" },
    {
      label: "Errors",
      before: parentFacts.errorCount,
      after: childFacts.errorCount,
      delta: signed(childFacts.errorCount - parentFacts.errorCount),
    },
    {
      label: "Repeated calls",
      before: parentFacts.duplicateToolCalls,
      after: childFacts.duplicateToolCalls,
      delta: signed(childFacts.duplicateToolCalls - parentFacts.duplicateToolCalls),
    },
    {
      label: "Tool calls",
      before: parentFacts.toolCalls,
      after: childFacts.toolCalls,
      delta: signed(childFacts.toolCalls - parentFacts.toolCalls),
    },
    {
      label: "Reported tokens",
      before: parentFacts.totalTokens ?? "n/a",
      after: childFacts.totalTokens ?? "n/a",
      delta: tokenDelta,
    },
    {
      label: "Latency",
      before: `${parentFacts.durationMs} ms`,
      after: `${childFacts.durationMs} ms`,
      delta: signed(childFacts.durationMs - parentFacts.durationMs, " ms"),
    },
  ];

  return (
    <section className="border border-emerald-200 bg-white" aria-labelledby="verified-summary-title">
      <div className="flex flex-col gap-4 border-b border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
            Deterministic comparison
          </p>
          <h2 id="verified-summary-title" className="mt-1 text-lg font-semibold text-zinc-950">
            The child removed the failure without mutating its parent
          </h2>
        </div>
        <span className="font-mono text-xs text-emerald-900">
          {comparison.outcomes.regressed.length} regressions detected
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-4 py-2 font-medium">Measured fact</th>
              <th className="px-4 py-2 font-medium">Parent</th>
              <th className="px-4 py-2 font-medium">Child</th>
              <th className="px-4 py-2 font-medium">Change</th>
            </tr>
          </thead>
          <tbody>
            {facts.map((fact) => (
              <tr key={fact.label} className="border-b border-zinc-100 last:border-b-0">
                <th className="px-4 py-2.5 font-medium text-zinc-700">{fact.label}</th>
                <td className="px-4 py-2.5 font-mono text-zinc-600">{fact.before}</td>
                <td className="px-4 py-2.5 font-mono font-semibold text-zinc-950">{fact.after}</td>
                <td className="px-4 py-2.5 font-mono text-emerald-800">{fact.delta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-3 border-t border-zinc-200 p-4">
        <Link
          href="/case-study"
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 active:translate-y-px"
        >
          View Case Study
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 active:translate-y-px"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Restart demo
        </button>
      </div>
    </section>
  );
}
