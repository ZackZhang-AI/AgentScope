import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  GitBranch,
  LockKeyhole,
  ShieldCheck,
  Target,
  Users,
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
  const demo = await getRecordedCodeFixDemo();
  const comparison = demo.comparison;
  const noProgress = demo.diagnostics.find(
    (diagnostic) => diagnostic.ruleId === "no-progress-loop",
  );
  const journey = [
    [t("case.journey.failure"), t("case.journey.failureDescription")],
    [t("case.journey.cause"), t("case.journey.causeDescription")],
    [t("case.journey.retry"), t("case.journey.retryDescription")],
    [t("case.journey.verify"), t("case.journey.verifyDescription")],
  ];
  const decisions = [
    [t("case.decision.evidence"), t("case.decision.evidenceDescription"), t("case.decision.evidenceTradeoff")],
    [t("case.decision.history"), t("case.decision.historyDescription"), t("case.decision.historyTradeoff")],
    [t("case.decision.scope"), t("case.decision.scopeDescription"), t("case.decision.scopeTradeoff")],
  ];

  return (
    <main className="min-h-[100dvh] bg-zinc-50 text-zinc-950">
      <AppHeader />

      <article>
        <header className="border-b border-zinc-200 bg-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:py-20">
            <div>
              <p className="text-sm font-semibold text-emerald-700">{t("case.eyebrow")}</p>
              <h1 className="mt-4 max-w-2xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
                {t("case.title")}
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-zinc-600">{t("case.description")}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href={localizedPath("/demos/code-fix-loop", locale)} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 active:translate-y-px">
                  {t("case.runDemo")}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <a href="https://github.com/ZackZhang-AI/AgentScope" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50">
                  {t("case.inspectSource")}
                </a>
              </div>
            </div>
            <figure className="overflow-hidden rounded-xl border border-zinc-300 bg-zinc-950 shadow-[10px_10px_0_0_#d4d4d8]">
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image src="/harnesslab-desktop.png" alt={t("case.imageAlt")} fill priority sizes="(min-width: 1024px) 52vw, 100vw" className="object-cover object-top" />
              </div>
              <figcaption className="border-t border-zinc-700 px-4 py-3 text-xs text-zinc-300">{t("case.productCaption")}</figcaption>
            </figure>
          </div>
        </header>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-20" aria-labelledby="problem-title">
          <div className="max-w-2xl">
            <h2 id="problem-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("case.problemTitle")}</h2>
            <p className="mt-4 text-base leading-7 text-zinc-600">{t("case.problemDescription")}</p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-[0.75fr_1.25fr]">
            <div className="rounded-xl bg-emerald-950 p-7 text-white">
              <Users className="h-6 w-6 text-emerald-300" aria-hidden="true" />
              <h3 className="mt-5 text-xl font-semibold">{t("case.userTitle")}</h3>
              <p className="mt-3 text-sm leading-7 text-emerald-50/80">{t("case.userDescription")}</p>
            </div>
            <div className="rounded-xl border border-zinc-300 bg-white p-7">
              <Target className="h-6 w-6 text-emerald-700" aria-hidden="true" />
              <h3 className="mt-5 text-xl font-semibold">{t("case.jobTitle")}</h3>
              <blockquote className="mt-4 border-l-2 border-emerald-600 pl-4 text-base leading-7 text-zinc-700">{t("case.jobStatement")}</blockquote>
            </div>
          </div>
        </section>

        <section className="border-y border-zinc-200 bg-white" aria-labelledby="journey-title">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-20">
            <h2 id="journey-title" className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">{t("case.journeyTitle")}</h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600">{t("case.journeyDescription")}</p>
            <ol className="mt-10 grid gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 md:grid-cols-4">
              {journey.map(([title, description], index) => (
                <li key={title} className="bg-zinc-50 p-5">
                  <span className="font-mono text-sm font-semibold text-emerald-700">{index + 1}</span>
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.68fr_1.32fr] lg:py-20" aria-labelledby="decisions-title">
          <div>
            <GitBranch className="h-7 w-7 text-emerald-700" aria-hidden="true" />
            <h2 id="decisions-title" className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">{t("case.decisionsTitle")}</h2>
            <p className="mt-4 text-base leading-7 text-zinc-600">{t("case.decisionsDescription")}</p>
          </div>
          <div className="border-t border-zinc-300">
            {decisions.map(([title, description, tradeoff]) => (
              <div key={title} className="border-b border-zinc-200 py-6">
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
                <p className="mt-3 text-xs leading-5 text-emerald-800"><span className="font-semibold">{t("case.tradeoff")}</span> {tradeoff}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-zinc-200 bg-zinc-950 text-white" aria-labelledby="results-title">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:py-20">
            <div>
              <CheckCircle2 className="h-7 w-7 text-emerald-400" aria-hidden="true" />
              <h2 id="results-title" className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">{t("case.resultsTitle")}</h2>
              <p className="mt-4 text-base leading-7 text-zinc-300">{t("case.resultsDescription")}</p>
            </div>
            <div className="grid gap-px overflow-hidden rounded-xl bg-zinc-800 sm:grid-cols-2">
              <div className="bg-zinc-900 p-5"><p className="text-xs text-zinc-400">{t("case.metric.northStar")}</p><p className="mt-2 text-lg font-semibold">{t("case.metric.northStarValue")}</p><p className="mt-2 text-xs leading-5 text-zinc-400">{t("case.metric.targetLabel")}</p></div>
              <div className="bg-zinc-900 p-5"><p className="text-xs text-zinc-400">{t("case.metric.test")}</p><p className="mt-2 text-lg font-semibold text-emerald-300">{comparison.parentFacts.errorCount} → {comparison.childFacts.errorCount}</p><p className="mt-2 text-xs leading-5 text-zinc-400">{t("case.metric.verifiedLabel")}</p></div>
              <div className="bg-zinc-900 p-5"><p className="text-xs text-zinc-400">{t("case.metric.repeats")}</p><p className="mt-2 text-lg font-semibold text-emerald-300">{comparison.parentFacts.duplicateToolCalls} → {comparison.childFacts.duplicateToolCalls}</p><p className="mt-2 text-xs leading-5 text-zinc-400">{t("case.metric.verifiedLabel")}</p></div>
              <div className="bg-zinc-900 p-5"><p className="text-xs text-zinc-400">{t("case.metric.evidence")}</p><p className="mt-2 text-lg font-semibold text-emerald-300">{noProgress?.evidenceSpanIds.length ?? 0}</p><p className="mt-2 text-xs leading-5 text-zinc-400">{t("case.metric.verifiedLabel")}</p></div>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20" aria-labelledby="role-title">
          <div>
            <h2 id="role-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("case.roleTitle")}</h2>
            <p className="mt-4 text-base leading-7 text-zinc-600">{t("case.roleDescription")}</p>
            <p className="mt-5 border-l-2 border-emerald-600 pl-4 text-sm leading-6 text-zinc-600">{t("case.roleDisclosure")}</p>
          </div>
          <div className="rounded-xl border border-zinc-300 bg-white p-7">
            <ShieldCheck className="h-6 w-6 text-emerald-700" aria-hidden="true" />
            <h2 className="mt-5 text-2xl font-semibold">{t("case.technicalTitle")}</h2>
            <p className="mt-3 text-sm leading-7 text-zinc-600">{t("case.technicalDescription")}</p>
            <details className="mt-5 border-t border-zinc-200 pt-5">
              <summary className="cursor-pointer text-sm font-semibold">{t("case.technicalDetails")}</summary>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-600">
                <li>{t("case.technical.checkpoint")}</li>
                <li>{t("case.technical.sandbox")}</li>
                <li>{t("case.technical.evaluation")}</li>
              </ul>
            </details>
          </div>
        </section>

        <section className="border-t border-zinc-200 bg-white" aria-labelledby="boundary-title">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[auto_1fr_auto] lg:items-center">
            <LockKeyhole className="h-8 w-8 text-zinc-600" aria-hidden="true" />
            <div>
              <h2 id="boundary-title" className="text-2xl font-semibold">{t("case.boundaryTitle")}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-600">{t("case.productBoundaryDescription")}</p>
            </div>
            <Link href={localizedPath("/demos/code-fix-loop", locale)} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">
              {t("case.inspectEvidence")}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </article>
    </main>
  );
}
