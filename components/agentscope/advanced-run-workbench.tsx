"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { useI18n } from "@/components/i18n-provider";
import { CodeFixLauncher } from "./code-fix-launcher";
import { TraceExplorer } from "./trace-explorer";
import { VerifiedFixSummary } from "./verified-fix-summary";
import { useCodeFixSession } from "./use-code-fix-session";

type AdvancedRunWorkbenchProps = {
  initialRunId?: string;
};

export function AdvancedRunWorkbench({
  initialRunId,
}: AdvancedRunWorkbenchProps) {
  const { t } = useI18n();
  const mainRef = useRef<HTMLElement>(null);
  const session = useCodeFixSession({ initialRunId });

  useEffect(() => {
    mainRef.current?.setAttribute("data-hydrated", "true");
  }, []);

  return (
    <main
      ref={mainRef}
      className="min-h-[100dvh] bg-zinc-100"
      data-hydrated="false"
    >
      <AppHeader provider={session.providerLabel} />
      {!initialRunId ? (
        <CodeFixLauncher
          capabilities={session.capabilities}
          provider={session.provider}
          busy={session.busy}
          onProviderChange={session.setProvider}
          onLoadDemo={() => void session.loadRecordedDemo({ navigate: true })}
          onRunSandbox={() => void session.runSandbox()}
        />
      ) : null}

      <div className="mx-auto grid max-w-[1800px] grid-cols-[minmax(0,1fr)] gap-4 p-4 lg:p-6">
        {session.error ? (
          <div className="flex gap-3 border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {session.error}
          </div>
        ) : null}

        {session.projection ? (
          <>
            {session.isVerified && session.parentProjection ? (
              <VerifiedFixSummary
                parent={session.parentProjection}
                child={session.projection}
                onRestart={() => void session.loadRecordedDemo({ navigate: true })}
              />
            ) : null}
            <TraceExplorer
              key={session.projection.run.id}
              events={session.events}
              projection={session.projection}
              isRunning={session.busy}
              provider={session.providerLabel}
              isForking={session.busy}
              onForkSpan={session.forkFromSpan}
              parentProjection={session.parentProjection}
              replayMode={session.mode === "recorded" ? "fixture" : "fork"}
            />
          </>
        ) : (
          <section className="flex min-h-80 items-center justify-center border border-dashed border-zinc-300 bg-white p-8 text-center">
            <div className="max-w-md">
              <h1 className="text-lg font-semibold text-zinc-950">
                {t("workbench.emptyTitle")}
              </h1>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                {t("workbench.emptyDescription")}
              </p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
