"use client";

import type { RefObject } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  FileSearch,
  GitBranch,
  LockKeyhole,
  RotateCcw,
  Search,
  ShieldCheck,
  TestTube2,
  Wrench,
  X,
} from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import type { DemoStage } from "./demo-progress";
import type { DemoEvidenceViewModel } from "./demo-evidence-view-model";

type GuidedDemoStageProps = {
  stage: DemoStage;
  view?: DemoEvidenceViewModel;
  busy: boolean;
  traceVisible: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onAdvance: () => void;
  onRestart: () => void;
  onToggleTrace: () => void;
};

const actionIcons = {
  read_file: FileSearch,
  search_code: Search,
  apply_patch: Wrench,
  run_tests: TestTube2,
};

function formatValue(value: number | undefined) {
  return value === undefined ? "-" : new Intl.NumberFormat().format(value);
}

export function GuidedDemoStage({
  stage,
  view,
  busy,
  traceVisible,
  headingRef,
  onAdvance,
  onRestart,
  onToggleTrace,
}: GuidedDemoStageProps) {
  const { localizedPath, t } = useI18n();

  if (stage === "intro") {
    return (
      <section className="mx-auto grid min-h-[560px] max-w-5xl items-center px-4 py-12 sm:px-6" aria-labelledby="demo-stage-title">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold text-emerald-700">{t("guided.intro.eyebrow")}</p>
            <h1
              ref={headingRef}
              id="demo-stage-title"
              tabIndex={-1}
              className="mt-4 text-4xl font-semibold leading-[1.08] tracking-tight outline-none sm:text-5xl"
            >
              {t("guided.intro.title")}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-zinc-600">
              {t("guided.intro.description")}
            </p>
            <button
              type="button"
              disabled={busy || !view}
              onClick={onAdvance}
              className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 active:translate-y-px disabled:cursor-wait disabled:opacity-60"
            >
              {busy ? t("guided.loading") : t("guided.intro.cta")}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="rounded-xl border border-zinc-300 bg-white p-6 shadow-[8px_8px_0_0_#d4d4d8] sm:p-8">
            <div className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-4">
              <div>
                <p className="text-xs font-medium text-zinc-500">{t("guided.intro.scenario")}</p>
                <p className="mt-1 font-semibold text-zinc-950">buggy-auth-api</p>
              </div>
              <span className="rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800">
                {t("guided.recordedBadge")}
              </span>
            </div>
            <div className="mt-6 space-y-5">
              <div className="flex gap-3">
                <CircleDot className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
                <div>
                  <p className="font-semibold">{t("guided.intro.taskTitle")}</p>
                  <p className="mt-1 text-sm leading-6 text-zinc-600">{t("guided.intro.taskDescription")}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
                <div>
                  <p className="font-semibold">{t("guided.intro.promiseTitle")}</p>
                  <p className="mt-1 text-sm leading-6 text-zinc-600">{t("guided.intro.promiseDescription")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!view) {
    return (
      <section className="mx-auto flex min-h-[520px] max-w-5xl items-center justify-center px-4 py-12 text-center">
        <p className="text-sm text-zinc-600">{t("guided.loading")}</p>
      </section>
    );
  }

  if (stage === "failure") {
    return (
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:py-14" aria-labelledby="demo-stage-title">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-red-700">{t("guided.failure.eyebrow")}</p>
          <h1 ref={headingRef} id="demo-stage-title" tabIndex={-1} className="mt-3 text-3xl font-semibold tracking-tight outline-none sm:text-4xl">
            {t("guided.failure.title")}
          </h1>
          <p className="mt-4 text-base leading-7 text-zinc-600">{t("guided.failure.description")}</p>
        </div>

        <ol className="mt-10 grid overflow-hidden rounded-xl border border-zinc-200 bg-white md:grid-cols-4">
          {view.actionPath.map((span, index) => {
            const Icon = actionIcons[span.name as keyof typeof actionIcons] ?? CircleDot;
            const failed = span.status === "error";
            return (
              <li key={span.id} className="relative border-b border-zinc-200 p-5 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
                <div className="flex items-center justify-between gap-3">
                  <Icon className={`h-5 w-5 ${failed ? "text-red-600" : "text-emerald-700"}`} aria-hidden="true" />
                  {index < view.actionPath.length - 1 ? <ChevronRight className="hidden h-4 w-4 text-zinc-300 md:block" aria-hidden="true" /> : null}
                </div>
                <p className="mt-5 text-sm font-semibold">{t(`guided.action.${span.name}` as "guided.action.read_file")}</p>
                <p className={`mt-1 text-xs font-medium ${failed ? "text-red-700" : "text-emerald-700"}`}>
                  {failed ? t("guided.failure.failed") : t("guided.failure.completed")}
                </p>
              </li>
            );
          })}
        </ol>

        <div className="mt-6 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-5 text-red-950">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
          <div>
            <h2 className="font-semibold">{t("guided.failure.resultTitle")}</h2>
            <p className="mt-1 text-sm leading-6 text-red-900/80">
              {view.firstFailureSpan?.error?.message ?? t("guided.failure.resultFallback")}
            </p>
          </div>
        </div>

        <button type="button" onClick={onAdvance} className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-lg bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 active:translate-y-px">
          {t("guided.failure.cta")}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </section>
    );
  }

  if (stage === "root-cause") {
    return (
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:py-14" aria-labelledby="demo-stage-title">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-amber-700">{t("guided.root.eyebrow")}</p>
          <h1 ref={headingRef} id="demo-stage-title" tabIndex={-1} className="mt-3 text-3xl font-semibold tracking-tight outline-none sm:text-4xl">
            {t("guided.root.title")}
          </h1>
          <p className="mt-4 text-base leading-7 text-zinc-600">{t("guided.root.description")}</p>
        </div>

        <div className="mt-9 grid gap-4 md:grid-cols-3">
          {view.repeatedSpans.map((span, index) => (
            <div key={span.id} className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">{t("guided.root.attempt", { count: index + 1 })}</span>
                <X className="h-4 w-4 text-red-600" aria-label={t("guided.failure.failed")} />
              </div>
              <p className="mt-5 text-sm font-semibold text-zinc-800">{t("guided.action.run_tests")}</p>
              <p className="mt-2 text-sm leading-6 text-amber-950">{t("guided.root.noChange")}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl bg-emerald-950 p-6 text-white">
          <h2 className="text-xl font-semibold">{t("guided.root.conclusionTitle")}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-emerald-50/80">{t("guided.root.conclusionDescription")}</p>
        </div>

        <details className="mt-5 rounded-xl border border-zinc-300 bg-white p-5">
          <summary className="cursor-pointer text-sm font-semibold text-zinc-800">{t("guided.rawEvidence")}</summary>
          <dl className="mt-4 grid gap-4 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-zinc-500">{t("guided.evidence.tool")}</dt>
              <dd className="mt-1 font-mono text-zinc-900">run_tests</dd>
            </div>
            <div>
              <dt className="text-zinc-500">{t("guided.evidence.rule")}</dt>
              <dd className="mt-1 font-mono text-zinc-900">no_progress_loop</dd>
            </div>
            <div>
              <dt className="text-zinc-500">{t("guided.evidence.confidence")}</dt>
              <dd className="mt-1 font-mono text-zinc-900">{Math.round((view.noProgress?.confidence ?? 0) * 100)}%</dd>
            </div>
            <div>
              <dt className="text-zinc-500">{t("guided.evidence.hash")}</dt>
              <dd className="mt-1 break-all font-mono text-zinc-900">{view.sharedProgressHash ?? t("guided.evidence.unavailable")}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">{t("guided.evidence.steps")}</dt>
              <dd className="mt-1 break-all font-mono text-zinc-900">{view.repeatedSpans.map((span) => span.id).join(", ")}</dd>
            </div>
          </dl>
        </details>

        <button type="button" onClick={onAdvance} className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-lg bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 active:translate-y-px">
          {t("guided.root.cta")}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </section>
    );
  }

  if (stage === "fork") {
    return (
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:py-14" aria-labelledby="demo-stage-title">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-emerald-700">{t("guided.fork.eyebrow")}</p>
          <h1 ref={headingRef} id="demo-stage-title" tabIndex={-1} className="mt-3 text-3xl font-semibold tracking-tight outline-none sm:text-4xl">
            {t("guided.fork.title")}
          </h1>
          <p className="mt-4 text-base leading-7 text-zinc-600">{t("guided.fork.description")}</p>
        </div>

        <div className="mt-9 grid gap-5 lg:grid-cols-[1fr_0.85fr]">
          <div className="rounded-xl bg-zinc-950 p-6 text-white sm:p-8">
            <div className="border border-zinc-700 bg-zinc-900 p-4">
              <p className="text-xs text-zinc-400">{t("guided.fork.original")}</p>
              <p className="mt-2 font-semibold text-red-300">{t("guided.fork.originalResult")}</p>
            </div>
            <div className="ml-8 h-8 border-l-2 border-emerald-500" aria-hidden="true" />
            <div className="ml-8 border border-emerald-700 bg-emerald-950/60 p-4">
              <div className="flex items-center gap-2 text-emerald-300">
                <GitBranch className="h-4 w-4" aria-hidden="true" />
                <p className="text-xs">{t("guided.fork.newAttempt")}</p>
              </div>
              <p className="mt-2 font-semibold">{t("guided.fork.newStrategy")}</p>
            </div>
          </div>
          <div className="rounded-xl border border-zinc-300 bg-white p-6">
            <h2 className="font-semibold">{t("guided.fork.safetyTitle")}</h2>
            <ul className="mt-5 space-y-4 text-sm text-zinc-700">
              {["parent", "checkpoint", "policy"].map((item) => (
                <li key={item} className="flex gap-3">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                  <span>{t(`guided.fork.safety.${item}` as "guided.fork.safety.parent")}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-lg bg-zinc-100 p-4 text-xs leading-5 text-zinc-600">
              <LockKeyhole className="mb-2 h-4 w-4 text-zinc-700" aria-hidden="true" />
              {t("guided.fork.recordedNote")}
            </div>
          </div>
        </div>

        <button type="button" disabled={busy || !view.forkSpanId} onClick={onAdvance} className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 active:translate-y-px disabled:cursor-wait disabled:opacity-60">
          {busy ? t("guided.fork.creating") : t("guided.fork.cta")}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </section>
    );
  }

  const { parentFacts, childFacts, outcomes } = view.comparison;
  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:py-14" aria-labelledby="demo-stage-title">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold text-emerald-700">{t("guided.verified.eyebrow")}</p>
        <h1 ref={headingRef} id="demo-stage-title" tabIndex={-1} className="mt-3 text-3xl font-semibold tracking-tight outline-none sm:text-4xl">
          {t("guided.verified.title")}
        </h1>
        <p className="mt-4 text-base leading-7 text-zinc-600">{t("guided.verified.description")}</p>
      </div>

      <div className="mt-9 grid gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 sm:grid-cols-3">
        <div className="bg-white p-5">
          <p className="text-xs text-zinc-500">{t("guided.verified.tests")}</p>
          <p className="mt-3 flex items-center gap-2 text-lg font-semibold"><X className="h-4 w-4 text-red-600" aria-hidden="true" />{t("guided.failed")}</p>
          <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />{t("guided.passed")}</p>
        </div>
        <div className="bg-white p-5">
          <p className="text-xs text-zinc-500">{t("guided.verified.errors")}</p>
          <p className="mt-3 text-2xl font-semibold">{parentFacts.errorCount} <span className="text-zinc-400">→</span> <span className="text-emerald-700">{childFacts.errorCount}</span></p>
        </div>
        <div className="bg-white p-5">
          <p className="text-xs text-zinc-500">{t("guided.verified.repeats")}</p>
          <p className="mt-3 text-2xl font-semibold">{parentFacts.duplicateToolCalls} <span className="text-zinc-400">→</span> <span className="text-emerald-700">{childFacts.duplicateToolCalls}</span></p>
        </div>
      </div>

      <div className={`mt-6 flex gap-3 rounded-xl border p-5 ${outcomes.regressed.length === 0 ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
        <div>
          <h2 className="font-semibold">{outcomes.regressed.length === 0 ? t("guided.verified.noRegression") : t("guided.verified.regression", { count: outcomes.regressed.length })}</h2>
          <p className="mt-1 text-sm leading-6 opacity-80">{t("guided.verified.conclusion")}</p>
        </div>
      </div>

      <details className="mt-5 rounded-xl border border-zinc-300 bg-white p-5">
        <summary className="cursor-pointer text-sm font-semibold text-zinc-800">{t("guided.verified.tradeoffs")}</summary>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
          <div><dt className="text-zinc-500">{t("guided.verified.tokens")}</dt><dd className="mt-1 font-mono">{formatValue(parentFacts.totalTokens)} → {formatValue(childFacts.totalTokens)}</dd></div>
          <div><dt className="text-zinc-500">{t("guided.verified.latency")}</dt><dd className="mt-1 font-mono">{parentFacts.durationMs} ms → {childFacts.durationMs} ms</dd></div>
          <div><dt className="text-zinc-500">{t("guided.verified.toolCalls")}</dt><dd className="mt-1 font-mono">{parentFacts.toolCalls} → {childFacts.toolCalls}</dd></div>
        </dl>
      </details>

      <div className="mt-8 flex flex-wrap gap-3">
        <button type="button" onClick={onToggleTrace} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 active:translate-y-px">
          {traceVisible ? t("guided.verified.hideTrace") : t("guided.verified.showTrace")}
        </button>
        <Link href={localizedPath("/case-study")} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50">
          {t("guided.verified.caseStudy")}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <button type="button" onClick={onRestart} className="inline-flex min-h-11 items-center gap-2 px-3 py-2.5 text-sm font-semibold text-zinc-600 hover:text-zinc-950">
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          {t("guided.verified.restart")}
        </button>
      </div>
    </section>
  );
}
