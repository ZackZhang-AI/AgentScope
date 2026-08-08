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
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { hasLocale, localizedPath } from "@/lib/i18n/config";
import { notFound } from "next/navigation";
import { localizedAlternates } from "@/lib/i18n/metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) return {};
  const dictionary = await getDictionary(locale);
  return {
    title: dictionary["case.metaTitle"],
    description: dictionary["case.metaDescription"],
    alternates: localizedAlternates("/case-study", locale),
  };
}

export default async function CaseStudyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const dictionary = await getDictionary(locale);
  const t = (key: keyof typeof dictionary) => dictionary[key];
  const securityControls = [
    [t("case.security.workspace"), t("case.security.workspaceControl"), t("case.security.workspaceReason")],
    ["Patch", t("case.security.patchControl"), t("case.security.patchReason")],
    [t("case.security.tests"), t("case.security.testsControl"), t("case.security.testsReason")],
    [t("case.security.runtime"), t("case.security.runtimeControl"), t("case.security.runtimeReason")],
  ];
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
                {t("case.eyebrow")}
              </p>
              <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">
                {t("case.title")}
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-zinc-600">
                {t("case.description")}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href={localizedPath("/demos/code-fix-loop", locale)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 active:translate-y-px"
                >
                  {t("case.runDemo")}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <a
                  href="https://github.com/ZackZhang-AI/AgentScope"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center rounded-md border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
                >
                  {t("case.inspectSource")}
                </a>
              </div>
            </div>

            <figure className="overflow-hidden border border-zinc-300 bg-zinc-950 shadow-[10px_10px_0_0_#d4d4d8]">
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src="/harnesslab-desktop.png"
                  alt={t("case.imageAlt")}
                  fill
                  priority
                  sizes="(min-width: 1024px) 52vw, 100vw"
                  className="object-cover object-top"
                />
              </div>
              <figcaption className="border-t border-zinc-700 px-4 py-3 font-mono text-[11px] text-zinc-300">
                {t("case.caption")}
              </figcaption>
            </figure>
          </div>
        </header>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-20" aria-labelledby="failure-title">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.72fr)_minmax(520px,1.28fr)]">
            <div>
              <h2 id="failure-title" className="text-3xl font-semibold tracking-tight">
                {t("case.failureTitle")}
              </h2>
              <p className="mt-4 text-sm leading-7 text-zinc-600">
                {t("case.failureDescription")}
              </p>
            </div>

            <div className="border-l-2 border-amber-500 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] font-semibold uppercase text-amber-800">no_progress_loop</p>
                  <p className="mt-1 text-base font-semibold">{t("case.hashUnchanged")}</p>
                </div>
                <span className="font-mono text-xs text-amber-900">
                  {t("case.confidence")} {Math.round((noProgress?.confidence ?? 0) * 100)}%
                </span>
              </div>
              <div className="mt-5 grid gap-px overflow-hidden border border-zinc-200 bg-zinc-200 sm:grid-cols-3">
                <div className="bg-zinc-50 p-4">
                  <p className="font-mono text-2xl font-semibold">{noProgress?.evidenceSpanIds.length ?? 0}</p>
                  <p className="mt-1 text-xs text-zinc-500">{t("case.evidenceSpans")}</p>
                </div>
                <div className="bg-zinc-50 p-4">
                  <p className="font-mono text-2xl font-semibold">{comparison.parentFacts.errorCount}</p>
                  <p className="mt-1 text-xs text-zinc-500">{t("case.capturedErrors")}</p>
                </div>
                <div className="bg-zinc-50 p-4">
                  <p className="font-mono text-2xl font-semibold">{comparison.parentFacts.duplicateToolCalls}</p>
                  <p className="mt-1 text-xs text-zinc-500">{t("case.duplicates")}</p>
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
                {t("case.forkTitle")}
              </h2>
              <p className="mt-4 text-sm leading-7 text-zinc-300">
                {t("case.forkDescription")}
              </p>
            </div>
            <div className="self-end font-mono text-xs leading-6 text-zinc-300">
              <div className="border border-zinc-700 bg-zinc-900 p-4">
                <p className="text-zinc-400">PARENT</p>
                <p className="mt-2 text-amber-300">{t("case.parentFlow")}</p>
              </div>
              <div className="ml-8 h-8 border-l border-emerald-500" aria-hidden="true" />
              <div className="ml-8 border border-emerald-700 bg-emerald-950/40 p-4">
                <p className="text-emerald-400">CHILD</p>
                <p className="mt-2">{t("case.childFlow")}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-20" aria-labelledby="security-title">
          <div className="grid gap-10 lg:grid-cols-[minmax(320px,0.7fr)_minmax(0,1.3fr)]">
            <div>
              <ShieldCheck className="h-7 w-7 text-emerald-700" aria-hidden="true" />
              <h2 id="security-title" className="mt-5 text-3xl font-semibold tracking-tight">
                {t("case.securityTitle")}
              </h2>
              <p className="mt-4 text-sm leading-7 text-zinc-600">
                {t("case.securityDescription")}
              </p>
            </div>
            <div
              className="overflow-x-auto border border-zinc-300 bg-white"
              tabIndex={0}
              role="region"
              aria-label={t("case.securityAria")}
            >
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">{t("case.boundary")}</th>
                    <th className="px-4 py-3 font-medium">{t("case.control")}</th>
                    <th className="px-4 py-3 font-medium">{t("case.whyMatters")}</th>
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
                  {t("case.verificationTitle")}
                </h2>
                <p className="mt-4 text-sm leading-7 text-zinc-600">
                  {t("case.verificationDescription")}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-px overflow-hidden border border-zinc-200 bg-zinc-200">
                <div className="bg-zinc-50 p-5">
                  <dt className="text-xs text-zinc-500">{t("case.runStatus")}</dt>
                  <dd className="mt-2 font-mono text-sm">error → success</dd>
                </div>
                <div className="bg-zinc-50 p-5">
                  <dt className="text-xs text-zinc-500">{t("analysis.errors")}</dt>
                  <dd className="mt-2 font-mono text-sm">{comparison.parentFacts.errorCount} → {comparison.childFacts.errorCount}</dd>
                </div>
                <div className="bg-zinc-50 p-5">
                  <dt className="text-xs text-zinc-500">{t("analysis.noProgressCalls")}</dt>
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
              <h2 id="boundary-title" className="text-2xl font-semibold tracking-tight">{t("case.boundaryTitle")}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-600">
                {t("case.boundaryDescription")}
              </p>
            </div>
            <Link
              href={localizedPath("/demos/code-fix-loop", locale)}
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              {t("case.inspectEvidence")}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </article>
    </main>
  );
}
