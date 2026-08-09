"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Download, FileText, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import {
  productDecisionBriefFilename,
  serializeProductDecisionBrief,
  type ProductDecisionBrief,
} from "./product-decision-brief";

type ActionStatus = "idle" | "success" | "error";

export function ProductDecisionBriefPanel({
  brief,
  onClose,
}: {
  brief: ProductDecisionBrief;
  onClose: () => void;
}) {
  const { locale, t } = useI18n();
  const [copyStatus, setCopyStatus] = useState<ActionStatus>("idle");
  const [downloadStatus, setDownloadStatus] = useState<ActionStatus>("idle");
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const markdown = serializeProductDecisionBrief(brief, t);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  async function copyMarkdown() {
    setCopyStatus("idle");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(markdown);
      setCopyStatus("success");
    } catch {
      setCopyStatus("error");
    }
  }

  function downloadMarkdown() {
    setDownloadStatus("idle");
    try {
      const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = productDecisionBriefFilename(locale);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setDownloadStatus("success");
    } catch {
      setDownloadStatus("error");
    }
  }

  return (
    <section ref={sectionRef} className="mx-auto max-w-5xl px-4 pb-12 sm:px-6" aria-labelledby="decision-brief-title">
      <div className="overflow-hidden rounded-xl border border-emerald-200 bg-white">
        <div className="flex items-start justify-between gap-4 bg-emerald-950 p-6 text-white sm:p-8">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-emerald-300">
              <FileText className="h-5 w-5" aria-hidden="true" />
              <p className="text-sm font-semibold">{t("brief.eyebrow")}</p>
            </div>
            <h2 ref={headingRef} id="decision-brief-title" tabIndex={-1} className="mt-4 text-2xl font-semibold tracking-tight outline-none sm:text-3xl">
              {t("brief.title")}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/80">{t("brief.subtitle")}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-emerald-100 hover:bg-emerald-900 active:translate-y-px" aria-label={t("brief.close")}>
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-6">
            <BriefText title={t("brief.section.task")} body={brief.task} />
            <BriefText title={t("brief.section.failure")} body={brief.failure} />
            <BriefText title={t("brief.section.rootCause")} body={brief.rootCause} />
            <BriefText title={t("brief.section.decision")} body={brief.recoveryDecision} />
          </div>
          <div className="space-y-7">
            <BriefList title={t("brief.section.verification")} items={brief.verification} emphasized />
            <BriefList title={t("brief.section.tradeoffs")} items={brief.tradeoffs} />
            <div>
              <h3 className="text-sm font-semibold text-zinc-950">{t("brief.section.evidence")}</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {brief.evidenceLinks.map((url, index) => (
                  <a key={url} href={url} className="inline-flex min-h-10 items-center rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-emerald-500 hover:text-emerald-800">
                    {t(`brief.evidence.${index + 1}` as "brief.evidence.1")}
                  </a>
                ))}
              </div>
            </div>
            <details className="rounded-lg bg-zinc-100 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-zinc-800">{t("brief.section.limitations")}</summary>
              <ul className="mt-3 space-y-2 text-xs leading-5 text-zinc-600">
                {brief.limitations.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </details>
          </div>
        </div>

        <div className="border-t border-zinc-200 px-6 py-5 sm:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void copyMarkdown()} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 active:translate-y-px">
              {copyStatus === "success" ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
              {copyStatus === "success" ? t("brief.copySuccess") : t("brief.copy")}
            </button>
            <button type="button" onClick={downloadMarkdown} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 active:translate-y-px">
              {downloadStatus === "success" ? <Check className="h-4 w-4 text-emerald-700" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
              {downloadStatus === "success" ? t("brief.downloadSuccess") : t("brief.download")}
            </button>
          </div>
          {copyStatus === "error" ? <p role="status" className="mt-3 text-sm text-amber-800">{t("brief.copyError")}</p> : null}
          {downloadStatus === "error" ? <p role="status" className="mt-3 text-sm text-red-700">{t("brief.downloadError")}</p> : null}
        </div>
      </div>
    </section>
  );
}

function BriefText({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-600">{body}</p>
    </div>
  );
}

function BriefList({ title, items, emphasized = false }: { title: string; items: string[]; emphasized?: boolean }) {
  return (
    <div className={emphasized ? "rounded-lg bg-emerald-50 p-5" : undefined}>
      <h3 className="text-sm font-semibold text-zinc-950">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-700">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
