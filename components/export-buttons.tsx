"use client";

import { Check, Copy, Download } from "lucide-react";
import { useState } from "react";
import { generateReviewCommentMarkdown } from "@/lib/report";
import type { AuditResponse } from "@/lib/types";
import { useI18n } from "@/components/i18n-provider";

type ExportButtonsProps = {
  result: AuditResponse | null;
};

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ExportButtons({ result }: ExportButtonsProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  async function copyReviewComment() {
    if (!result) return;
    await navigator.clipboard.writeText(
      generateReviewCommentMarkdown({
        summary: result.summary,
        riskScore: result.riskScore,
        findings: result.findings,
      }),
    );
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section className="grid gap-2">
      <button
        type="button"
        disabled={!result}
        onClick={() => result && download(`${result.id}.md`, result.reportMarkdown, "text/markdown")}
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 active:translate-y-px disabled:cursor-not-allowed disabled:text-zinc-400"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        {t("audit.exportMarkdown")}
      </button>
      <button
        type="button"
        disabled={!result}
        onClick={() =>
          result && download(`${result.id}.json`, JSON.stringify(result, null, 2), "application/json")
        }
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 active:translate-y-px disabled:cursor-not-allowed disabled:text-zinc-400"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        {t("audit.exportJson")}
      </button>
      <button
        type="button"
        disabled={!result}
        onClick={copyReviewComment}
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 active:translate-y-px disabled:cursor-not-allowed disabled:text-zinc-400"
      >
        {copied ? (
          <Check className="h-4 w-4 text-emerald-700" aria-hidden="true" />
        ) : (
          <Copy className="h-4 w-4" aria-hidden="true" />
        )}
        {copied ? t("audit.copied") : t("audit.copyPrComment")}
      </button>
    </section>
  );
}
