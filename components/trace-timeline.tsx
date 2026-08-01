"use client";

import { AlertCircle, CheckCircle2, Circle, Loader2 } from "lucide-react";
import type { AgentEvent } from "@/lib/types";
import { useI18n } from "@/components/i18n-provider";

type TraceTimelineProps = {
  events: AgentEvent[];
  isRunning: boolean;
};

const statusIcon = {
  pending: Circle,
  running: Loader2,
  complete: CheckCircle2,
  warning: AlertCircle,
  error: AlertCircle,
};

export function TraceTimeline({ events, isRunning }: TraceTimelineProps) {
  const { t } = useI18n();
  const displayEvents =
    events.length > 0
      ? events
      : [
          {
            id: "intake",
            stage: "intake",
            status: isRunning ? "running" : "pending",
            title: isRunning ? t("audit.starting") : t("audit.waitingInput"),
            detail: isRunning
              ? t("audit.routingRequest")
              : t("audit.chooseInput"),
            timestamp: new Date(0).toISOString(),
          } satisfies AgentEvent,
        ];

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-950">{t("trace.title")}</h2>
          <p className="mt-1 text-sm text-zinc-600">{t("audit.traceDescription")}</p>
        </div>
      </div>
      <ol className="grid gap-3">
        {displayEvents.map((event, index) => {
          const Icon = statusIcon[event.status];
          const color =
            event.status === "warning"
              ? "text-amber-700"
              : event.status === "error"
                ? "text-red-700"
                : event.status === "complete"
                  ? "text-emerald-700"
                  : "text-zinc-500";

          return (
            <li key={`${event.id}-${index}`} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <div className="flex gap-3">
                <Icon
                  className={`mt-0.5 h-4 w-4 shrink-0 ${color} ${event.status === "running" ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-zinc-950">{event.title}</h3>
                    <span className="rounded-md bg-white px-2 py-1 font-mono text-[11px] text-zinc-600 ring-1 ring-zinc-200">
                      {event.stage}
                    </span>
                    {event.durationMs !== undefined ? (
                      <span className="font-mono text-[11px] text-zinc-500">
                        {event.durationMs} ms
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-zinc-700">{event.detail}</p>
                  {event.artifact ? (
                    <pre className="mt-2 overflow-auto rounded-md bg-zinc-950 p-2 font-mono text-xs leading-5 text-zinc-100">
                      {event.artifact}
                    </pre>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
