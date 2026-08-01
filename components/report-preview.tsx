"use client";

import ReactMarkdown from "react-markdown";
import { useI18n } from "@/components/i18n-provider";

type ReportPreviewProps = {
  markdown?: string;
};

export function ReportPreview({ markdown }: ReportPreviewProps) {
  const { t } = useI18n();
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-zinc-950">{t("audit.reportPreview")}</h2>
        <p className="mt-1 text-sm text-zinc-600">{t("audit.reportHint")}</p>
      </div>
      {markdown ? (
        <div className="prose prose-zinc max-w-none text-sm leading-6 prose-headings:font-semibold prose-h1:text-xl prose-h2:text-base prose-h3:text-sm prose-p:my-2 prose-ul:my-2">
          <ReactMarkdown>{markdown}</ReactMarkdown>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm leading-6 text-zinc-600">
          {t("audit.reportEmpty")}
        </div>
      )}
    </section>
  );
}
