"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { useI18n } from "@/components/i18n-provider";
import { buildDemoEvidenceViewModel } from "./demo-evidence-view-model";
import { DemoProgress, type DemoStage, type DemoStepId } from "./demo-progress";
import { demoStageProgress, nextDemoStage, parseDemoStage } from "./demo-state";
import { GuidedDemoStage } from "./guided-demo-stage";
import { TraceExplorer } from "./trace-explorer";
import { useCodeFixSession } from "./use-code-fix-session";

export function GuidedCodeFixDemo() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const mainRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const requestedStage = parseDemoStage(searchParams);
  const stage = requestedStage;
  const [initialRecordedChild] = useState(requestedStage === "verified");
  const session = useCodeFixSession({
    autoLoadDemo: true,
    initialRecordedChild,
  });
  const [highestStep, setHighestStep] = useState(demoStageProgress(requestedStage));
  const traceVisible = searchParams.get("details") === "trace";
  const view = useMemo(
    () => session.demo ? buildDemoEvidenceViewModel(session.demo) : undefined,
    [session.demo],
  );

  useEffect(() => {
    mainRef.current?.setAttribute("data-hydrated", "true");
  }, []);

  useEffect(() => {
    if (stage === "intro") return;
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [stage]);

  function updateUrl(nextStage: DemoStage, details?: "trace") {
    const params = new URLSearchParams(window.location.search);
    params.delete("view");
    params.set("step", nextStage);
    if (details) params.set("details", details);
    else params.delete("details");
    const query = params.toString();
    window.history.pushState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
    );
    setHighestStep((current) => Math.max(current, demoStageProgress(nextStage)));
    if (nextStage !== "verified" && session.isVerified) {
      session.resetRecordedParent();
    }
  }

  async function advance() {
    if (stage === "fork" && view?.forkSpanId) {
      const created = await session.forkFromSpan(view.forkSpanId, { navigate: false });
      if (created) updateUrl("verified");
      return;
    }
    const nextStage = nextDemoStage(stage);
    if (nextStage) updateUrl(nextStage);
  }

  function selectCompletedStep(nextStage: DemoStepId) {
    if (demoStageProgress(nextStage) <= highestStep) updateUrl(nextStage);
  }

  function restart() {
    session.resetRecordedParent();
    setHighestStep(-1);
    window.history.replaceState(null, "", window.location.pathname);
  }

  function toggleTrace() {
    updateUrl("verified", traceVisible ? undefined : "trace");
  }

  return (
    <main
      ref={mainRef}
      className="min-h-[100dvh] overflow-x-hidden bg-zinc-50 text-zinc-950"
      data-hydrated="false"
    >
      <AppHeader />
      <DemoProgress
        current={stage}
        highestStep={highestStep}
        onSelect={selectCompletedStep}
      />

      {session.error ? (
        <div className="mx-auto mt-6 flex max-w-5xl gap-3 border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p>{session.error}</p>
            <button
              type="button"
              onClick={() => void session.loadRecordedDemo()}
              className="mt-2 font-semibold underline underline-offset-4"
            >
              {t("guided.retry")}
            </button>
          </div>
        </div>
      ) : null}

      <GuidedDemoStage
        stage={stage}
        view={view}
        busy={session.busy}
        traceVisible={traceVisible}
        headingRef={headingRef}
        onAdvance={() => void advance()}
        onRestart={restart}
        onToggleTrace={toggleTrace}
      />

      {stage === "verified" && traceVisible && session.projection ? (
        <section className="mx-auto max-w-[1800px] px-4 pb-12 sm:px-6" aria-labelledby="advanced-evidence-title">
          <div className="mb-4 border-l-2 border-emerald-600 pl-4">
            <h2 id="advanced-evidence-title" className="text-xl font-semibold">{t("guided.advancedTitle")}</h2>
            <p className="mt-1 text-sm text-zinc-600">{t("guided.advancedDescription")}</p>
          </div>
          <TraceExplorer
            key={session.projection.run.id}
            events={session.events}
            projection={session.projection}
            isRunning={session.busy}
            provider={session.providerLabel}
            isForking={session.busy}
            onForkSpan={session.forkFromSpan}
            parentProjection={session.parentProjection}
            replayMode="fixture"
          />
        </section>
      ) : null}
    </main>
  );
}
