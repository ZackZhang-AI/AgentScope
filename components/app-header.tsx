"use client";

import { BookOpenText, Code2, Play, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { LocaleSwitcher } from "./locale-switcher";
import { useI18n } from "./i18n-provider";

type AppHeaderProps = {
  provider?: string;
};

export function AppHeader({ provider }: AppHeaderProps) {
  const { localizedPath, t } = useI18n();
  return (
    <header className="border-b border-zinc-200 bg-white px-4 sm:px-6">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-3 py-3 lg:flex-nowrap">
      <Link href={localizedPath("/")} className="flex items-center gap-2.5 rounded-md">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
          <ShieldCheck className="h-4.5 w-4.5" aria-hidden="true" />
        </div>
        <div>
          <div className="text-lg font-semibold tracking-tight text-zinc-950">
            AgentScope
          </div>
          <p className="hidden text-[11px] text-zinc-500 sm:block">{t("header.tagline")}</p>
        </div>
      </Link>
      <nav className="flex flex-wrap items-center justify-end gap-1.5 text-sm" aria-label={t("header.navigation")}>
        <LocaleSwitcher />
        <Link
          href={localizedPath("/demos/code-fix-loop")}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950"
        >
          <Play className="h-4 w-4" aria-hidden="true" />
          {t("header.demo")}
        </Link>
        <Link
          href={localizedPath("/case-study")}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950"
        >
          <BookOpenText className="h-4 w-4" aria-hidden="true" />
          {t("header.caseStudy")}
        </Link>
        {provider ? <span className="hidden rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-xs text-zinc-600 xl:inline-flex">
          {t("header.provider")}: <span className="font-medium capitalize text-zinc-950">{provider}</span>
        </span> : null}
        <a
          href="https://github.com/ZackZhang-AI/AgentScope"
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 py-2 font-medium text-zinc-800 transition hover:border-zinc-400 hover:bg-zinc-50"
          target="_blank"
          rel="noreferrer"
        >
          <Code2 className="h-4 w-4" aria-hidden="true" />
          {t("header.github")}
        </a>
      </nav>
      </div>
    </header>
  );
}
