"use client";

import { Clock, Trash2 } from "lucide-react";
import type { AuditResponse } from "@/lib/types";
import { useI18n } from "@/components/i18n-provider";

type SessionHistoryProps = {
  sessions: AuditResponse[];
  onRestore: (session: AuditResponse) => void;
  onClear: () => void;
};

export function SessionHistory({ sessions, onRestore, onClear }: SessionHistoryProps) {
  const { t } = useI18n();
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-emerald-700" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-zinc-950">{t("manager.title")}</h2>
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={!sessions.length}
          className="inline-flex items-center justify-center rounded-md p-2 text-zinc-500 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-300"
          aria-label={t("manager.clear")}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-3 grid gap-2">
        {sessions.length ? (
          sessions.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => onRestore(session)}
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-left transition hover:border-emerald-300 hover:bg-emerald-50"
            >
              <span className="block truncate text-sm font-medium text-zinc-950">{session.findings[0]?.title ?? session.summary}</span>
              <span className="mt-1 block font-mono text-xs text-zinc-500">
                {session.provider} · {t("audit.risk")} {session.riskScore} ·{" "}
                {t("audit.lineCount", { count: session.inputMeta.estimatedLines })}
              </span>
            </button>
          ))
        ) : (
          <p className="text-sm leading-6 text-zinc-600">{t("audit.sessionsEmpty")}</p>
        )}
      </div>
    </section>
  );
}
