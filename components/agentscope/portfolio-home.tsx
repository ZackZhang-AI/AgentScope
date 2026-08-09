import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Code2,
  FileSearch,
  GitBranch,
  Play,
  ShieldCheck,
  Target,
} from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { localizedPath, type Locale } from "@/lib/i18n/config";

const journeyIcons = [FileSearch, Target, GitBranch, CheckCircle2];

export async function PortfolioHome({ locale }: { locale: Locale }) {
  const dictionary = await getDictionary(locale);
  const t = (key: keyof typeof dictionary) => dictionary[key];
  const journey = [
    [t("home.journey.failure"), t("home.journey.failureDescription")],
    [t("home.journey.cause"), t("home.journey.causeDescription")],
    [t("home.journey.retry"), t("home.journey.retryDescription")],
    [t("home.journey.verify"), t("home.journey.verifyDescription")],
  ];
  const decisions = [
    [t("home.decision.evidence"), t("home.decision.evidenceDescription")],
    [t("home.decision.immutable"), t("home.decision.immutableDescription")],
    [t("home.decision.deterministic"), t("home.decision.deterministicDescription")],
  ];

  return (
    <main className="min-h-[100dvh] bg-zinc-50 text-zinc-950">
      <AppHeader />

      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(520px,1.1fr)] lg:items-center lg:py-16">
          <div>
            <p className="text-sm font-semibold text-emerald-700">{t("home.eyebrow")}</p>
            <h1 className="mt-4 max-w-2xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              {t("home.title")}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-zinc-600">
              {t("home.description")}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href={localizedPath("/demos/code-fix-loop", locale)}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 active:translate-y-px"
              >
                <Play className="h-4 w-4" aria-hidden="true" />
                {t("home.startDemo")}
              </Link>
              <Link
                href={localizedPath("/case-study", locale)}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 transition hover:border-zinc-400 hover:bg-zinc-50 active:translate-y-px"
              >
                {t("home.caseStudy")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>

          <Link
            href={localizedPath("/demos/code-fix-loop", locale)}
            className="group overflow-hidden rounded-xl border border-zinc-300 bg-zinc-950 shadow-[10px_10px_0_0_#d4d4d8]"
            aria-label={t("home.previewAria")}
          >
            <div className="relative aspect-[4/3] overflow-hidden">
              <Image
                src="/harnesslab-desktop.png"
                alt={t("home.previewAlt")}
                fill
                priority
                sizes="(min-width: 1024px) 52vw, 100vw"
                className="object-cover object-top transition duration-300 group-hover:scale-[1.01]"
              />
            </div>
            <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-3 text-sm text-zinc-200">
              <span>{t("home.previewCaption")}</span>
              <ArrowRight className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            </div>
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-20">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("home.problemTitle")}</h2>
          <p className="mt-4 text-base leading-7 text-zinc-600">{t("home.problemDescription")}</p>
        </div>
        <div className="mt-10 grid gap-6 border-t border-zinc-300 pt-8 md:grid-cols-[1.2fr_0.8fr]">
          <div className="bg-emerald-950 p-7 text-white sm:p-9">
            <Target className="h-7 w-7 text-emerald-300" aria-hidden="true" />
            <h3 className="mt-6 max-w-lg text-2xl font-semibold">{t("home.primaryUserTitle")}</h3>
            <p className="mt-3 max-w-xl text-sm leading-7 text-emerald-50/80">{t("home.primaryUserDescription")}</p>
          </div>
          <div className="grid gap-px bg-zinc-200">
            <div className="bg-white p-6">
              <h3 className="font-semibold">{t("home.userDeveloper")}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{t("home.userDeveloperDescription")}</p>
            </div>
            <div className="bg-white p-6">
              <h3 className="font-semibold">{t("home.userQuality")}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{t("home.userQualityDescription")}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-20">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">{t("home.journeyTitle")}</h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600">{t("home.journeyDescription")}</p>
          <ol className="mt-10 grid gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 md:grid-cols-4">
            {journey.map(([title, description], index) => {
              const Icon = journeyIcons[index];
              return (
                <li key={title} className="bg-zinc-50 p-5">
                  <Icon className="h-5 w-5 text-emerald-700" aria-hidden="true" />
                  <h3 className="mt-5 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
                </li>
              );
            })}
          </ol>
          <Link
            href={localizedPath("/demos/code-fix-loop", locale)}
            className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-lg bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 active:translate-y-px"
          >
            {t("home.experienceJourney")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.72fr_1.28fr] lg:py-20">
        <div>
          <ShieldCheck className="h-7 w-7 text-emerald-700" aria-hidden="true" />
          <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">{t("home.decisionsTitle")}</h2>
          <p className="mt-4 max-w-md text-base leading-7 text-zinc-600">{t("home.decisionsDescription")}</p>
        </div>
        <div className="border-t border-zinc-300">
          {decisions.map(([title, description]) => (
            <div key={title} className="grid gap-2 border-b border-zinc-200 py-6 sm:grid-cols-[0.42fr_0.58fr] sm:gap-8">
              <h3 className="font-semibold text-zinc-950">{title}</h3>
              <p className="text-sm leading-6 text-zinc-600">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-zinc-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("home.resultsTitle")}</h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-zinc-300">{t("home.resultsDescription")}</p>
            <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-zinc-800">
              <div className="bg-zinc-900 p-5">
                <dt className="text-xs text-zinc-400">{t("home.resultDemo")}</dt>
                <dd className="mt-2 text-lg font-semibold text-emerald-300">{t("home.resultDemoValue")}</dd>
              </div>
              <div className="bg-zinc-900 p-5">
                <dt className="text-xs text-zinc-400">{t("home.resultEnvironment")}</dt>
                <dd className="mt-2 text-lg font-semibold text-emerald-300">{t("home.resultEnvironmentValue")}</dd>
              </div>
              <div className="bg-zinc-900 p-5">
                <dt className="text-xs text-zinc-400">{t("home.resultAccessibility")}</dt>
                <dd className="mt-2 text-lg font-semibold text-emerald-300">{t("home.resultAccessibilityValue")}</dd>
              </div>
              <div className="bg-zinc-900 p-5">
                <dt className="text-xs text-zinc-400">{t("home.resultEvidence")}</dt>
                <dd className="mt-2 text-lg font-semibold text-emerald-300">{t("home.resultEvidenceValue")}</dd>
              </div>
            </dl>
          </div>
          <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-7 sm:p-9">
            <h2 className="text-2xl font-semibold">{t("home.roleTitle")}</h2>
            <p className="mt-4 text-sm leading-7 text-zinc-300">{t("home.roleDescription")}</p>
            <p className="mt-5 border-l-2 border-emerald-500 pl-4 text-sm leading-7 text-zinc-400">{t("home.roleDisclosure")}</p>
            <a
              href="https://github.com/ZackZhang-AI/AgentScope"
              target="_blank"
              rel="noreferrer"
              className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-lg border border-zinc-600 px-4 py-2.5 text-sm font-semibold text-white hover:border-zinc-400 hover:bg-zinc-800"
            >
              <Code2 className="h-4 w-4" aria-hidden="true" />
              {t("home.viewSource")}
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("home.finalTitle")}</h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600">{t("home.finalDescription")}</p>
          </div>
          <Link
            href={localizedPath("/demos/code-fix-loop", locale)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 active:translate-y-px"
          >
            {t("home.startDemo")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </main>
  );
}
