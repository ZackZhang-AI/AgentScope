"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { localizedPath, type Locale } from "@/lib/i18n/config";
import { useI18n } from "./i18n-provider";

export function LocaleSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, t } = useI18n();

  function navigate(target: Locale, event: React.MouseEvent<HTMLAnchorElement>) {
    const suffix = `${window.location.search}${window.location.hash}`;
    if (!suffix) return;
    event.preventDefault();
    router.push(localizedPath(`${pathname}${suffix}`, target));
  }

  return (
    <div
      className="inline-flex rounded-lg border border-zinc-300 bg-zinc-50 p-1 text-xs font-semibold"
      role="group"
      aria-label="Language"
    >
      {(["en", "zh"] as const).map((target) => (
        <Link
          key={target}
          href={localizedPath(pathname, target)}
          hrefLang={target === "zh" ? "zh-CN" : "en"}
          lang={target === "zh" ? "zh-CN" : "en"}
          aria-label={t(target === "en" ? "language.switchToEnglish" : "language.switchToChinese")}
          aria-current={locale === target ? "page" : undefined}
          onClick={(event) => navigate(target, event)}
          className={`rounded-md px-2.5 py-1.5 transition ${
            locale === target
              ? "bg-zinc-950 text-white"
              : "text-zinc-600 hover:bg-white hover:text-zinc-950"
          }`}
        >
          {t(target === "en" ? "language.english" : "language.chinese")}
        </Link>
      ))}
    </div>
  );
}
