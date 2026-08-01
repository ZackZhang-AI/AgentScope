"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, CheckCircle2, Play, ShieldX, X } from "lucide-react";
import type { ReplayPreflight } from "@/lib/agentscope/replay/preflight";
import type { Span } from "@/lib/agentscope/domain/span";
import { useI18n } from "@/components/i18n-provider";

type ReplayPreflightDialogProps = {
  target: Span;
  preflight: ReplayPreflight;
  provider: string;
  mode: "fixture" | "fork";
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

const policyStyle = {
  execute: "bg-emerald-50 text-emerald-800",
  fixed_response: "bg-amber-50 text-amber-800",
  blocked: "bg-red-50 text-red-800",
};

export function ReplayPreflightDialog({
  target,
  preflight,
  provider,
  mode,
  isSubmitting,
  onClose,
  onConfirm,
}: ReplayPreflightDialogProps) {
  const { t } = useI18n();
  const blocked = preflight.status === "blocked";
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
      <dialog
        ref={dialogRef}
        aria-labelledby="replay-preflight-title"
        onCancel={(event) => {
          event.preventDefault();
          if (!isSubmitting) onClose();
        }}
        className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-auto rounded-lg border border-zinc-300 bg-white p-0 text-zinc-950 shadow-xl backdrop:bg-zinc-950/45"
      >
        <header className="flex items-start justify-between gap-4 border-b border-zinc-200 p-4">
          <div>
            <h2 id="replay-preflight-title" className="text-base font-semibold text-zinc-950">
              {t("replay.title")}
            </h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              {mode === "fixture"
                ? t("replay.fixtureDescription", { name: target.name })
                : t("replay.forkDescription", { name: target.name })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-md border border-zinc-200 p-2 text-zinc-500 hover:bg-zinc-50"
            aria-label={t("replay.close")}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="grid gap-4 p-4">
          <div className={`flex gap-3 border p-3 ${
            blocked
              ? "border-red-200 bg-red-50"
              : "border-emerald-200 bg-emerald-50"
          }`}>
            {blocked
              ? <ShieldX className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
              : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />}
            <div>
              <p className={`text-xs font-semibold ${blocked ? "text-red-900" : "text-emerald-900"}`}>
                {blocked
                  ? t("replay.blocked")
                  : mode === "fixture"
                    ? t("replay.fixtureReady")
                    : t("replay.childReady")}
              </p>
              <p className={`mt-1 text-xs leading-5 ${blocked ? "text-red-800" : "text-emerald-800"}`}>
                {t("replay.checkpointProvider", { checkpoint: preflight.checkpointId ?? t("replay.notAvailable"), provider })}
              </p>
            </div>
          </div>

          {preflight.reasons.length > 0 ? (
            <div>
              <h3 className="text-xs font-semibold text-zinc-900">{t("replay.blockingReasons")}</h3>
              <ul className="mt-2 grid gap-2">
                {preflight.reasons.map((reason) => (
                  <li key={reason} className="flex gap-2 text-xs leading-5 text-red-800">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <h3 className="text-xs font-semibold text-zinc-900">{t("replay.executionScope")}</h3>
            <div className="mt-2 overflow-hidden rounded-md border border-zinc-200">
              {preflight.actions.map((action) => (
                <div
                  key={action.spanId}
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-zinc-100 p-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-zinc-900">{action.name}</p>
                    <p className="mt-1 text-[11px] leading-4 text-zinc-500">{action.reason}</p>
                  </div>
                  <span className={`self-start rounded-md px-2 py-1 font-mono text-[10px] ${policyStyle[action.policy]}`}>
                    {action.policy}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <footer className="flex justify-end gap-2 border-t border-zinc-200 bg-zinc-50 p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            {t("replay.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={blocked || isSubmitting}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
            {isSubmitting
              ? mode === "fixture" ? t("replay.loadingFixture") : t("replay.creatingChild")
              : mode === "fixture" ? t("replay.replayFixture") : t("replay.createChild")}
          </button>
        </footer>
      </dialog>
  );
}
