"use client";

import { BookOpenText, Code2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { LocaleSwitcher } from "./locale-switcher";
import { useI18n } from "./i18n-provider";

type AppHeaderProps = {
  provider: string;
};

export function AppHeader({ provider }: AppHeaderProps) {
  const { localizedPath, t } = useI18n();
  return (
    <header className="flex flex-col gap-4 border-b border-zinc-200 bg-white px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
      <Link href={localizedPath("/")} className="flex items-start gap-3 rounded-md">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <div className="text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl">
            AgentScope
          </div>
          <p className="max-w-3xl text-sm leading-6 text-zinc-600">
            {t("header.description")}
          </p>
        </div>
      </Link>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <LocaleSwitcher />
        <Link
          href={localizedPath("/case-study")}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 font-medium text-zinc-800 transition hover:border-zinc-400 hover:bg-zinc-50"
        >
          <BookOpenText className="h-4 w-4" aria-hidden="true" />
          {t("header.caseStudy")}
        </Link>
        <span className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-700">
          {t("header.provider")}: <span className="font-medium capitalize text-zinc-950">{provider}</span>
        </span>
        <a
          href="https://github.com/ZackZhang-AI/AgentScope"
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 font-medium text-zinc-800 transition hover:border-zinc-400 hover:bg-zinc-50"
          target="_blank"
          rel="noreferrer"
        >
          <Code2 className="h-4 w-4" aria-hidden="true" />
          {t("header.github")}
        </a>
      </div>
    </header>
  );
}
