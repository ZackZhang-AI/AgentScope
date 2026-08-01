"use client";

import { useState } from "react";
import { FlaskConical, GitCompareArrows, RotateCcw } from "lucide-react";
import type { DemoRun } from "@/lib/agentscope/fixtures/catalog";

type DemoRunLibraryProps = {
  onLoad: (run: DemoRun, parent?: DemoRun) => void;
};

const icon = {
  "successful-code-audit": FlaskConical,
  "failed-repeated-tool": RotateCcw,
  "forked-successful-code-audit": GitCompareArrows,
};

export function DemoRunLibrary({ onLoad }: DemoRunLibraryProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function load(slug: DemoRun["slug"]) {
    setIsLoading(true);
    setError(undefined);
    try {
      const response = await fetch("/api/v1/demo-runs");
      if (!response.ok) throw new Error("Demo catalog could not be loaded.");
      const payload = await response.json() as { runs: DemoRun[] };
      const run = payload.runs.find((item) => item.slug === slug);
      if (!run) throw new Error("Requested demo run was not found.");
      const parent = run.result.trace.run.parentRunId
        ? payload.runs.find((item) => item.result.id === run.result.trace.run.parentRunId)
        : undefined;
      onLoad(run, parent);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Demo catalog could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }

  const demos: { slug: DemoRun["slug"]; label: string; detail: string }[] = [
    {
      slug: "successful-code-audit",
      label: "Successful trace",
      detail: "Nested model, tool, artifact and token data.",
    },
    {
      slug: "failed-repeated-tool",
      label: "Repeated tool failure",
      detail: "Three identical failures with a replay checkpoint.",
    },
    {
      slug: "forked-successful-code-audit",
      label: "Fork recovery compare",
      detail: "Fixed child run aligned against its failed parent.",
    },
  ];

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4" aria-labelledby="demo-runs-title">
      <div className="flex items-center gap-2">
        <FlaskConical className="h-4 w-4 text-emerald-700" aria-hidden="true" />
        <h2 id="demo-runs-title" className="text-sm font-semibold text-zinc-950">Black-box demos</h2>
      </div>
      <p className="mt-1 text-xs leading-5 text-zinc-500">
        Fixed offline traces. No model key or network data source required.
      </p>
      <div className="mt-3 grid gap-2">
        {demos.map((demo) => {
          const Icon = icon[demo.slug];
          return (
            <button
              key={demo.slug}
              type="button"
              disabled={isLoading}
              onClick={() => void load(demo.slug)}
              className="flex items-start gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-left hover:border-zinc-300 hover:bg-white disabled:opacity-50"
            >
              <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
              <span>
                <span className="block text-xs font-semibold text-zinc-900">{demo.label}</span>
                <span className="mt-0.5 block text-[11px] leading-4 text-zinc-500">{demo.detail}</span>
              </span>
            </button>
          );
        })}
      </div>
      {error ? <p className="mt-2 text-xs leading-5 text-red-700">{error}</p> : null}
    </section>
  );
}
