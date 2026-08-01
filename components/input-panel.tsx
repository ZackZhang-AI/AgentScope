"use client";

import {
  FlaskConical,
  GitPullRequest,
  Loader2,
  Play,
  RotateCcw,
} from "lucide-react";
import type {
  AuditRequest,
  AuditRule,
  InputType,
  Intensity,
  Provider,
} from "@/lib/types";
import { sampleList } from "@/lib/samples";
import { useI18n } from "@/components/i18n-provider";

const auditRules: AuditRule[] = ["security", "reliability", "testing", "maintainability", "performance"];

type InputPanelProps = {
  content: string;
  inputType: InputType;
  provider: Provider;
  intensity: Intensity;
  rules: AuditRule[];
  pullRequestUrl: string;
  source?: AuditRequest["source"];
  isRunning: boolean;
  isImporting: boolean;
  onContentChange: (content: string) => void;
  onInputTypeChange: (inputType: InputType) => void;
  onProviderChange: (provider: Provider) => void;
  onIntensityChange: (intensity: Intensity) => void;
  onRulesChange: (rules: AuditRule[]) => void;
  onPullRequestUrlChange: (url: string) => void;
  onImportPullRequest: () => void;
  onRun: () => void;
  onReset: () => void;
};

export function InputPanel({
  content,
  inputType,
  provider,
  intensity,
  rules,
  pullRequestUrl,
  source,
  isRunning,
  isImporting,
  onContentChange,
  onInputTypeChange,
  onProviderChange,
  onIntensityChange,
  onRulesChange,
  onPullRequestUrlChange,
  onImportPullRequest,
  onRun,
  onReset,
}: InputPanelProps) {
  const { t } = useI18n();
  return (
    <section className="flex min-h-0 flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4">
      <div>
        <h2 className="text-sm font-semibold text-zinc-950">{t("audit.inputControl")}</h2>
        <p className="mt-1 text-sm leading-6 text-zinc-600">
          {t("audit.inputDescription")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-lg bg-zinc-100 p-1">
        {(["diff", "files"] as const).map((type) => (
          <button
            key={type}
            type="button"
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              inputType === type
                ? "bg-white text-zinc-950 shadow-sm"
                : "text-zinc-600 hover:bg-zinc-50"
            }`}
            onClick={() => onInputTypeChange(type)}
          >
            {type === "diff" ? "Diff" : t("audit.fileSnippets")}
          </button>
        ))}
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-zinc-800" htmlFor="pr-url">
          {t("audit.publicPr")}
        </label>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <input
            id="pr-url"
            type="url"
            value={pullRequestUrl}
            onChange={(event) => onPullRequestUrlChange(event.target.value)}
            placeholder="https://github.com/owner/repo/pull/123"
            className="min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
          <button
            type="button"
            aria-label={t("audit.importPr")}
            title={t("audit.importPr")}
            onClick={onImportPullRequest}
            disabled={isImporting || !pullRequestUrl.trim()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-300"
          >
            {isImporting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <GitPullRequest className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
        {source?.kind === "github-pr" ? (
          <p className="truncate text-xs text-emerald-700">
            {t("audit.importedFrom", { url: source.url ?? "" })}
          </p>
        ) : null}
      </div>

      <label className="grid gap-2 text-sm font-medium text-zinc-800">
        {t("audit.codeInput")}
        <textarea
          aria-label={t("audit.codeInput")}
          value={content}
          onChange={(event) => onContentChange(event.target.value)}
          spellCheck={false}
          className="min-h-[260px] resize-y rounded-lg border border-zinc-300 bg-zinc-950 p-3 font-mono text-xs leading-5 text-zinc-50 outline-none transition placeholder:text-zinc-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          placeholder={t("audit.codePlaceholder")}
        />
      </label>

      <div className="grid gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-800">
          <FlaskConical className="h-4 w-4 text-emerald-700" aria-hidden="true" />
          {t("audit.samples")}
        </div>
        <div className="grid gap-2">
          {sampleList.map((sample) => (
            <button
              key={sample.id}
              type="button"
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left text-sm font-medium text-zinc-800 transition hover:border-emerald-300 hover:bg-emerald-50"
              onClick={() => {
                onInputTypeChange(sample.inputType);
                onContentChange(sample.content);
              }}
            >
              {sample.title}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-zinc-800">
          Provider
          <select
            aria-label="Provider"
            value={provider}
            onChange={(event) => onProviderChange(event.target.value as Provider)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="mock">{t("audit.mockDemo")}</option>
            <option value="deepseek">DeepSeek</option>
            <option value="minimax">MiniMax</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-800">
          {t("audit.intensity")}
          <select
            aria-label="Intensity"
            value={intensity}
            onChange={(event) => onIntensityChange(event.target.value as Intensity)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="quick">{t("audit.quick")}</option>
            <option value="standard">{t("audit.standard")}</option>
          </select>
        </label>
      </div>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium text-zinc-800">{t("audit.rules")}</legend>
        <div className="grid grid-cols-2 gap-2">
          {auditRules.map((rule) => (
            <label
              key={rule}
              className="flex min-w-0 items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700"
            >
              <input
                type="checkbox"
                checked={rules.includes(rule)}
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...rules, rule]
                    : rules.filter((value) => value !== rule);
                  if (next.length) onRulesChange(next);
                }}
                className="h-4 w-4 accent-emerald-700"
              />
              <span className="truncate">{t(`audit.rule.${rule}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {provider !== "mock" ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
          {provider === "deepseek"
            ? t("audit.deepseekKey")
            : t("audit.minimaxKey")}
        </p>
      ) : null}

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <button
          type="button"
          onClick={onRun}
          disabled={isRunning}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 active:translate-y-px disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          <Play className="h-4 w-4" aria-hidden="true" />
          {isRunning ? t("trace.running") : t("audit.run")}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-3 text-zinc-700 transition hover:bg-zinc-50 active:translate-y-px"
          aria-label={t("audit.reset")}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
