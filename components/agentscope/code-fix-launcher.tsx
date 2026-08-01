"use client";

import {
  Bot,
  BookOpenText,
  CirclePlay,
  Container,
} from "lucide-react";
import type { CodeFixRunRequest } from "@/lib/agentscope/execution";
import { useI18n } from "@/components/i18n-provider";

export type AgentScopeCapabilities = {
  executionProfile: "recorded_only" | "local_sandbox";
  recordedDemo: { available: boolean };
  sandbox: {
    available: boolean;
    storage: boolean;
    docker: boolean;
    reason?: string;
  };
  providers: Record<
    CodeFixRunRequest["decisionProvider"],
    { available: boolean; reason?: string }
  >;
};

type CodeFixLauncherProps = {
  capabilities?: AgentScopeCapabilities;
  provider: CodeFixRunRequest["decisionProvider"];
  busy: boolean;
  onProviderChange: (provider: CodeFixRunRequest["decisionProvider"]) => void;
  onLoadDemo: () => void;
  onRunSandbox: () => void;
};

function Capability({
  available,
  children,
}: {
  available: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-zinc-500">
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          available ? "bg-emerald-600" : "bg-zinc-300"
        }`}
        aria-hidden="true"
      />
      {children}
    </span>
  );
}

export function CodeFixLauncher({
  capabilities,
  provider,
  busy,
  onProviderChange,
  onLoadDemo,
  onRunSandbox,
}: CodeFixLauncherProps) {
  const { localizedPath, t } = useI18n();
  const sandboxAvailable = capabilities?.sandbox.available ?? false;
  const providerAvailable =
    capabilities?.providers[provider]?.available ?? provider === "fixture";
  const canRun = sandboxAvailable && providerAvailable && !busy;
  const recordedOnly = capabilities?.executionProfile === "recorded_only";

  return (
    <section className="border-b border-zinc-200 bg-white" aria-labelledby="code-fix-launcher-title">
      <div className={`mx-auto grid max-w-[1800px] gap-5 px-4 py-6 lg:px-6 lg:py-8 ${
        recordedOnly ? "" : "lg:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.7fr)]"
      }`}>
        <div>
          <p className="font-mono text-xs font-semibold text-emerald-700">
            {t("launcher.eyebrow")}
          </p>
          <h1
            id="code-fix-launcher-title"
            className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl"
          >
            {t("launcher.title")}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
            {t("launcher.description")}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={onLoadDemo}
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 active:translate-y-px disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              <CirclePlay className="h-4 w-4" aria-hidden="true" />
              {t("launcher.startDemo")}
            </button>
            <a
              href={localizedPath("/case-study")}
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 active:translate-y-px"
            >
              {t("launcher.readCaseStudy")}
              <BookOpenText className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            <Capability available>
              {t("launcher.recordedCapability")}
            </Capability>
            <Capability available={sandboxAvailable}>
              {t("launcher.dockerCapability")}
            </Capability>
            <Capability available={Boolean(capabilities?.sandbox.storage)}>
              {t("launcher.postgresCapability")}
            </Capability>
          </div>
        </div>

        {!recordedOnly ? <div className="border-l-2 border-emerald-600 bg-zinc-50 p-4">
          <div className="flex items-start gap-3">
            <Container className="mt-0.5 h-5 w-5 text-zinc-700" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-zinc-950">
                {t("launcher.executeTitle")}
              </h2>
              <p className="mt-1 text-xs leading-5 text-zinc-600">
                {t("launcher.executeDescription")}
              </p>
            </div>
          </div>
          <label className="mt-4 block text-xs font-medium text-zinc-700">
            {t("launcher.decisionProvider")}
            <select
              value={provider}
              onChange={(event) =>
                onProviderChange(
                  event.target.value as CodeFixRunRequest["decisionProvider"],
                )
              }
              className="mt-1.5 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
            >
              <option value="fixture">{t("launcher.fixtureDecisions")}</option>
              <option value="deepseek">{t("launcher.deepseekModel")}</option>
              <option value="minimax">{t("launcher.minimaxModel")}</option>
            </select>
          </label>
          <button
            type="button"
            disabled={!canRun}
            onClick={onRunSandbox}
            className="mt-3 inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-md border border-zinc-950 bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 active:translate-y-px disabled:cursor-not-allowed disabled:border-zinc-300 disabled:bg-zinc-300"
          >
            <Bot className="h-4 w-4" aria-hidden="true" />
            {busy
              ? t("launcher.runningSandbox")
              : provider === "fixture"
                ? t("launcher.runSandbox")
                : t("launcher.useLiveModel")}
          </button>
          {!canRun && !busy ? (
            <p className="mt-2 text-xs leading-5 text-amber-800">
              {capabilities?.sandbox.reason ??
                capabilities?.providers[provider]?.reason ??
                t("launcher.checkingCapabilities")}
            </p>
          ) : null}
        </div> : null}
      </div>
    </section>
  );
}
