import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  GitBranch,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { getRecordedCodeFixDemo } from "@/lib/agentscope/execution";

export const metadata: Metadata = {
  title: "Case Study | AgentScope",
  description:
    "How AgentScope traces a stalled code-repair agent, forks an immutable checkpoint and verifies the child run with deterministic evidence.",
};

const securityControls = [
  ["Workspace", "Per-run isolated copy", "A child restores state without writing to Parent."],
  ["Patch", "Scenario file allowlist", "Out-of-scope files are rejected before mutation."],
  ["Tests", "Server-owned command", "Models never provide arbitrary shell commands."],
  ["Runtime", "Non-root, offline container", "CPU, memory and execution time stay bounded."],
] as const;

export default async function CaseStudyPage() {
  const demo = await getRecordedCodeFixDemo();
  const comparison = demo.comparison;
  const noProgress = demo.diagnostics.find(
    (diagnostic) => diagnostic.ruleId === "no-progress-loop",
  );

  return (
    <main className="min-h-[100dvh] bg-zinc-100 text-zinc-950">
      <AppHeader provider="fixture" />

      <article>
        <header className="border-b border-zinc-200 bg-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(520px,1.1fr)] lg:items-center lg:py-20">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Product and engineering case study
              </p>
              <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">
                A final answer cannot explain why an agent failed
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-zinc-600">
                AgentScope turns one code-repair run into an inspectable execution record. It connects the first failure, a no-progress loop, an immutable fork and a verified child result through evidence spans.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/demos/code-fix-loop"
                  className="inline-flex min-h-11 items-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 active:translate-y-px"
                >
                  Run the 90-second demo
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <a
                  href="https://github.com/ZackZhang-AI/HarnessLab"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center rounded-md border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                >
                  Inspect the source
                </a>
              </div>
            </div>

            <figure className="overflow-hidden border border-zinc-300 bg-zinc-950 shadow-[10px_10px_0_0_#d4d4d8]">
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src="/harnesslab-desktop.png"
                  alt="AgentScope trace explorer showing an agent run timeline, span tree and inspector"
                  fill
                  priority
                  sizes="(min-width: 1024px) 52vw, 100vw"
                  className="object-cover object-top"
                />
              </div>
              <figcaption className="border-t border-zinc-700 px-4 py-3 font-mono text-[11px] text-zinc-300">
                One projection drives Trace, Diagnostics, Compare and Eval.
              </figcaption>
            </figure>
          </div>
        </header>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-20" aria-labelledby="failure-title">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.72fr)_minmax(520px,1.28fr)]">
            <div>
              <h2 id="failure-title" className="text-3xl font-semibold tracking-tight">
                The parent did work, but made no progress
              </h2>
              <p className="mt-4 text-sm leading-7 text-zinc-600">
                Tool names and inputs alone can mislabel a legitimate retry. AgentScope adds workspace and test-result hashes to the call signature. Three identical test calls with unchanged state become a deterministic no-progress finding.
              </p>
            </div>

            <div className="border-l-2 border-amber-500 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] font-semibold uppercase text-amber-800">no-progress-loop</p>
                  <p className="mt-1 text-base font-semibold">Workspace hash + result hash stayed unchanged</p>
                </div>
                <span className="font-mono text-xs text-amber-900">
                  {Math.round((noProgress?.confidence ?? 0) * 100)}% confidence
                </span>
              </div>
              <div className="mt-5 grid gap-px overflow-hidden border border-zinc-200 bg-zinc-200 sm:grid-cols-3">
                <div className="bg-zinc-50 p-4">
                  <p className="font-mono text-2xl font-semibold">{noProgress?.evidenceSpanIds.length ?? 0}</p>
                  <p className="mt-1 text-xs text-zinc-500">evidence spans</p>
                </div>
                <div className="bg-zinc-50 p-4">
                  <p className="font-mono text-2xl font-semibold">{comparison.parentFacts.errorCount}</p>
                  <p className="mt-1 text-xs text-zinc-500">captured errors</p>
                </div>
                <div className="bg-zinc-50 p-4">
                  <p className="font-mono text-2xl font-semibold">{comparison.parentFacts.duplicateToolCalls}</p>
                  <p className="mt-1 text-xs text-zinc-500">attributable duplicates</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-zinc-800 bg-zinc-950 text-white" aria-labelledby="fork-title">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
            <div>
              <GitBranch className="h-7 w-7 text-emerald-400" aria-hidden="true" />
              <h2 id="fork-title" className="mt-5 text-3xl font-semibold tracking-tight">
                Forking is a state transition, not a retry button
              </h2>
              <p className="mt-4 text-sm leading-7 text-zinc-300">
                A checkpoint records the fixture version, accumulated patch, tool version and workspace snapshot reference. Fork restores that state into a child workspace. Parent events and artifacts remain immutable, so comparison evidence cannot be rewritten by the recovery attempt.
              </p>
            </div>
            <div className="self-end font-mono text-xs leading-6 text-zinc-300">
              <div className="border border-zinc-700 bg-zinc-900 p-4">
                <p className="text-zinc-400">PARENT</p>
                <p className="mt-2 text-amber-300">failed run_tests → checkpoint</p>
              </div>
              <div className="ml-8 h-8 border-l border-emerald-500" aria-hidden="true" />
              <div className="ml-8 border border-emerald-700 bg-emerald-950/40 p-4">
                <p className="text-emerald-400">CHILD</p>
                <p className="mt-2">restore snapshot → new strategy → verified test</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-20" aria-labelledby="security-title">
          <div className="grid gap-10 lg:grid-cols-[minmax(320px,0.7fr)_minmax(0,1.3fr)]">
            <div>
              <ShieldCheck className="h-7 w-7 text-emerald-700" aria-hidden="true" />
              <h2 id="security-title" className="mt-5 text-3xl font-semibold tracking-tight">
                The model chooses actions. The server owns authority.
              </h2>
              <p className="mt-4 text-sm leading-7 text-zinc-600">
                The public deployment only serves recorded evidence. Local sandbox execution is restricted to one built-in scenario and fails closed when its dependencies are unavailable.
              </p>
            </div>
            <div
              className="overflow-x-auto border border-zinc-300 bg-white"
              tabIndex={0}
              role="region"
              aria-label="Sandbox security controls"
            >
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Boundary</th>
                    <th className="px-4 py-3 font-medium">Control</th>
                    <th className="px-4 py-3 font-medium">Why it matters</th>
                  </tr>
                </thead>
                <tbody>
                  {securityControls.map(([boundary, control, reason]) => (
                    <tr key={boundary} className="border-b border-zinc-100 last:border-0">
                      <th className="px-4 py-3 font-semibold text-zinc-900">{boundary}</th>
                      <td className="px-4 py-3 font-mono text-xs text-emerald-800">{control}</td>
                      <td className="px-4 py-3 text-xs leading-5 text-zinc-600">{reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="border-t border-zinc-200 bg-white" aria-labelledby="evidence-title">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-20">
            <div className="grid gap-10 lg:grid-cols-2">
              <div>
                <CheckCircle2 className="h-7 w-7 text-emerald-700" aria-hidden="true" />
                <h2 id="evidence-title" className="mt-5 text-3xl font-semibold tracking-tight">
                  Verification stays attached to trace evidence
                </h2>
                <p className="mt-4 text-sm leading-7 text-zinc-600">
                  Compare reports resolved errors, regressions and trade-offs. Eval uses versioned deterministic rules for test success, patch scope, replay safety and loop efficiency. Every claim links back to its supporting Span.
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-px overflow-hidden border border-zinc-200 bg-zinc-200">
                <div className="bg-zinc-50 p-5">
                  <dt className="text-xs text-zinc-500">Run status</dt>
                  <dd className="mt-2 font-mono text-sm">error → success</dd>
                </div>
                <div className="bg-zinc-50 p-5">
                  <dt className="text-xs text-zinc-500">Errors</dt>
                  <dd className="mt-2 font-mono text-sm">{comparison.parentFacts.errorCount} → {comparison.childFacts.errorCount}</dd>
                </div>
                <div className="bg-zinc-50 p-5">
                  <dt className="text-xs text-zinc-500">No-progress calls</dt>
                  <dd className="mt-2 font-mono text-sm">{comparison.parentFacts.duplicateToolCalls} → {comparison.childFacts.duplicateToolCalls}</dd>
                </div>
                <div className="bg-zinc-50 p-5">
                  <dt className="text-xs text-zinc-500">Child Eval</dt>
                  <dd className="mt-2 font-mono text-sm">{demo.childEval.overallScore}/100 · {demo.childEval.verdict}</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <section className="border-t border-zinc-200 bg-zinc-100" aria-labelledby="boundary-title">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
            <LockKeyhole className="h-8 w-8 text-zinc-600" aria-hidden="true" />
            <div>
              <h2 id="boundary-title" className="text-2xl font-semibold tracking-tight">Why arbitrary repositories are out of scope</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-600">
                Safe execution of unknown repositories requires stronger isolation, supply-chain controls, tenancy, retention policies and an asynchronous worker plane. The portfolio keeps one constrained scenario so its security claims remain honest and verifiable.
              </p>
            </div>
            <Link
              href="/demos/code-fix-loop"
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Inspect the evidence
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </article>
    </main>
  );
}
