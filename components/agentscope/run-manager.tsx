"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Clock,
  Download,
  GitBranch,
  GitCompareArrows,
  Pencil,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { RunProjection, TraceEvent } from "@/lib/agentscope/domain";
import type { RunSummary } from "@/lib/agentscope/application/trace-repository";
import type { AuditResponse } from "@/lib/types";
import {
  createRunBundle,
  parseRunBundle,
} from "@/lib/agentscope/transfer/run-bundle";
import { useI18n } from "@/components/i18n-provider";

export type RunSelection = {
  projection: RunProjection;
  events: TraceEvent[];
  response?: AuditResponse;
};

type RunManagerProps = {
  sessions: AuditResponse[];
  currentRunId?: string;
  currentSelection?: RunSelection;
  onOpenRun: (selection: RunSelection) => void;
  onCompareRuns: (baseline: RunSelection, candidate: RunSelection) => void;
  onClearLocal: () => void;
};

type RunRow = RunSummary & {
  source: "browser" | "database";
};

function sessionToRow(session: AuditResponse): RunRow {
  const run = session.trace.run;
  return {
    id: run.id,
    projectId: run.projectId,
    name: session.findings[0]?.title ?? session.summary,
    tags: [],
    status: run.status,
    taskType: run.taskType,
    provider: run.configSnapshot.provider,
    model: run.configSnapshot.model,
    parentRunId: run.parentRunId,
    forkedFromSpanId: run.forkedFromSpanId,
    createdAt: run.createdAt,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    spanCount: session.trace.spans.length,
    errorCount: session.trace.spans.filter((span) => span.status === "error").length,
    source: "browser",
  };
}

async function fetchSelection(
  runId: string,
  sessions: AuditResponse[],
): Promise<RunSelection> {
  const local = sessions.find((session) => session.id === runId);
  if (local) {
    return { projection: local.trace, events: [], response: local };
  }

  const [runResponse, eventResponse] = await Promise.all([
    fetch(`/api/v1/runs/${encodeURIComponent(runId)}`),
    fetch(`/api/v1/runs/${encodeURIComponent(runId)}/events?after=0`),
  ]);
  if (!runResponse.ok || !eventResponse.ok) {
    throw new Error(`Run ${runId} could not be loaded.`);
  }
  const runPayload = await runResponse.json() as { trace: RunProjection };
  const eventPayload = await eventResponse.json() as { events: TraceEvent[] };
  return {
    projection: runPayload.trace,
    events: eventPayload.events,
  };
}

export function RunManager({
  sessions,
  currentRunId,
  currentSelection,
  onOpenRun,
  onCompareRuns,
  onClearLocal,
}: RunManagerProps) {
  const { t } = useI18n();
  const [persistentRuns, setPersistentRuns] = useState<RunSummary[]>([]);
  const [storageMode, setStorageMode] = useState<"loading" | "connected" | "browser">(
    "loading",
  );
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [provider, setProvider] = useState("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [editingRunId, setEditingRunId] = useState<string>();
  const [editName, setEditName] = useState("");
  const [editTags, setEditTags] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);

  async function refreshPersistentRuns() {
    try {
      const response = await fetch("/api/v1/runs?limit=100");
      if (!response.ok) {
        setStorageMode("browser");
        return;
      }
      const payload = await response.json() as { runs: RunSummary[] };
      setPersistentRuns(payload.runs);
      setStorageMode("connected");
    } catch {
      setStorageMode("browser");
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refreshPersistentRuns();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const rows = useMemo(() => {
    const merged = new Map<string, RunRow>();
    for (const run of persistentRuns) {
      merged.set(run.id, { ...run, source: "database" });
    }
    for (const session of sessions) {
      const local = sessionToRow(session);
      const persisted = merged.get(local.id);
      merged.set(local.id, persisted ? { ...persisted, source: "browser" } : local);
    }

    const normalizedQuery = query.trim().toLowerCase();
    return [...merged.values()]
      .filter((run) => status === "all" || run.status === status)
      .filter((run) => provider === "all" || run.provider === provider)
      .filter(
        (run) =>
          !normalizedQuery ||
          [run.id, run.name, run.model, ...run.tags]
            .filter(Boolean)
            .some((value) => value?.toLowerCase().includes(normalizedQuery)),
      )
      .sort((left, right) => {
        const delta = Date.parse(right.createdAt) - Date.parse(left.createdAt);
        return sort === "newest" ? delta : -delta;
      });
  }, [persistentRuns, provider, query, sessions, sort, status]);

  const providers = useMemo(
    () => [...new Set(rows.map((run) => run.provider))].sort(),
    [rows],
  );

  async function openRun(runId: string) {
    setBusy(true);
    setError(undefined);
    try {
      onOpenRun(await fetchSelection(runId, sessions));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("manager.loadError"));
    } finally {
      setBusy(false);
    }
  }

  async function compareSelected() {
    if (compareIds.length !== 2) return;
    setBusy(true);
    setError(undefined);
    try {
      const [baseline, candidate] = await Promise.all(
        compareIds.map((runId) => fetchSelection(runId, sessions)),
      );
      onCompareRuns(baseline, candidate);
    } catch (compareError) {
      setError(
        compareError instanceof Error ? compareError.message : t("manager.compareError"),
      );
    } finally {
      setBusy(false);
    }
  }

  function toggleCompare(runId: string) {
    setCompareIds((current) => {
      if (current.includes(runId)) return current.filter((id) => id !== runId);
      return current.length === 2 ? [current[1], runId] : [...current, runId];
    });
  }

  function beginEdit(run: RunRow) {
    setEditingRunId(run.id);
    setEditName(run.name);
    setEditTags(run.tags.join(", "));
  }

  async function saveMetadata(runId: string) {
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch(`/api/v1/runs/${encodeURIComponent(runId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: editName,
          tags: editTags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        }),
      });
      if (!response.ok) throw new Error(t("manager.saveError"));
      const payload = await response.json() as { run: RunSummary };
      setPersistentRuns((current) =>
        current.map((run) => (run.id === runId ? payload.run : run)),
      );
      setEditingRunId(undefined);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t("manager.saveError"));
    } finally {
      setBusy(false);
    }
  }

  function exportCurrentRun() {
    if (!currentSelection) return;
    const bundle = createRunBundle(
      currentSelection.projection,
      currentSelection.events,
    );
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(bundle, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `agentscope-run-${bundle.runId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importBundle(file?: File) {
    if (!file) return;
    setError(undefined);
    try {
      const bundle = parseRunBundle(JSON.parse(await file.text()));
      onOpenRun({
        projection: bundle.projection,
        events: bundle.events,
      });
    } catch (importError) {
      setError(
        importError instanceof Error
          ? t("manager.importErrorDetail", { message: importError.message })
          : t("manager.importError"),
      );
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4" aria-labelledby="run-manager-title">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-emerald-700" aria-hidden="true" />
          <h2 id="run-manager-title" className="text-sm font-semibold text-zinc-950">
            {t("manager.title")}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-mono text-[10px] text-zinc-500">
            {storageMode === "connected" ? t("manager.databaseBrowser") : t("manager.browserOnly")}
          </span>
          <button
            type="button"
            onClick={onClearLocal}
            disabled={!sessions.length}
            className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 disabled:text-zinc-300"
            aria-label={t("manager.clear")}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="relative col-span-2">
          <span className="sr-only">{t("manager.filter")}</span>
          <Search className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("manager.filter")}
            className="h-8 w-full rounded-md border border-zinc-300 pl-7 pr-2 text-xs"
          />
        </label>
        <select aria-label={t("manager.filterStatus")} value={status} onChange={(event) => setStatus(event.target.value)} className="h-8 rounded-md border border-zinc-300 px-2 text-xs">
          <option value="all">{t("manager.allStatuses")}</option>
          <option value="running">{t("trace.running")}</option>
          <option value="success">{t("trace.success")}</option>
          <option value="success_with_warnings">{t("manager.warnings")}</option>
          <option value="error">{t("trace.error")}</option>
          <option value="cancelled">{t("trace.cancelled")}</option>
        </select>
        <select aria-label={t("manager.filterProvider")} value={provider} onChange={(event) => setProvider(event.target.value)} className="h-8 rounded-md border border-zinc-300 px-2 text-xs">
          <option value="all">{t("manager.allProviders")}</option>
          {providers.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select aria-label={t("manager.sort")} value={sort} onChange={(event) => setSort(event.target.value as "newest" | "oldest")} className="h-8 rounded-md border border-zinc-300 px-2 text-xs">
          <option value="newest">{t("manager.newest")}</option>
          <option value="oldest">{t("manager.oldest")}</option>
        </select>
        <button
          type="button"
          disabled={compareIds.length !== 2 || busy}
          onClick={compareSelected}
          className="inline-flex h-8 items-center justify-center gap-1 rounded-md bg-zinc-950 px-2 text-xs font-semibold text-white disabled:bg-zinc-300"
        >
          <GitCompareArrows className="h-3.5 w-3.5" aria-hidden="true" />
          {t("manager.compare", { count: compareIds.length })}
        </button>
        <button
          type="button"
          onClick={() => importInputRef.current?.click()}
          className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-zinc-300 bg-white px-2 text-xs font-semibold text-zinc-700"
        >
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
          {t("manager.importJson")}
        </button>
        <button
          type="button"
          disabled={!currentSelection}
          onClick={exportCurrentRun}
          className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-zinc-300 bg-white px-2 text-xs font-semibold text-zinc-700 disabled:text-zinc-300"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          {t("manager.exportRun")}
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label={t("manager.importAria")}
          onChange={(event) => void importBundle(event.target.files?.[0])}
        />
      </div>

      {error ? <p className="mt-2 text-xs leading-5 text-red-700">{error}</p> : null}

      <div className="mt-3 grid max-h-96 gap-2 overflow-auto">
        {rows.length ? rows.map((run) => (
          <article
            key={run.id}
            className={`rounded-lg border p-2 ${currentRunId === run.id ? "border-emerald-400 bg-emerald-50" : "border-zinc-200 bg-zinc-50"}`}
          >
            {editingRunId === run.id ? (
              <div className="grid gap-2">
                <input aria-label={t("manager.runName")} value={editName} onChange={(event) => setEditName(event.target.value)} className="h-8 rounded-md border border-zinc-300 px-2 text-xs" />
                <input aria-label={t("manager.runTags")} value={editTags} onChange={(event) => setEditTags(event.target.value)} placeholder={t("manager.tagsPlaceholder")} className="h-8 rounded-md border border-zinc-300 px-2 text-xs" />
                <div className="flex gap-2">
                  <button type="button" onClick={() => saveMetadata(run.id)} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800"><Check className="h-3.5 w-3.5" />{t("manager.save")}</button>
                  <button type="button" onClick={() => setEditingRunId(undefined)} className="inline-flex items-center gap-1 text-xs text-zinc-600"><X className="h-3.5 w-3.5" />{t("manager.cancel")}</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-2">
                  <button type="button" onClick={() => openRun(run.id)} disabled={busy} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-medium text-zinc-950">{run.name}</span>
                    <span className="mt-1 block truncate font-mono text-[10px] text-zinc-500">
                      {run.id} · {run.status} · {run.provider} · {run.spanCount} spans
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleCompare(run.id)}
                    className={`rounded-md border px-2 py-1 font-mono text-[10px] ${compareIds.includes(run.id) ? "border-emerald-500 bg-emerald-100 text-emerald-900" : "border-zinc-300 text-zinc-500"}`}
                    aria-label={t(compareIds.includes(run.id) ? "manager.removeCompare" : "manager.selectCompare", { runId: run.id })}
                  >
                    {compareIds.indexOf(run.id) === 0 ? "A" : compareIds.indexOf(run.id) === 1 ? "B" : t("manager.compareLabel")}
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {run.parentRunId ? (
                    <button type="button" onClick={() => openRun(run.parentRunId!)} className="inline-flex items-center gap-1 rounded bg-violet-50 px-1.5 py-0.5 font-mono text-[10px] text-violet-800" title={run.parentRunId}>
                      <GitBranch className="h-3 w-3" aria-hidden="true" />
                      parent
                    </button>
                  ) : null}
                  {run.tags.map((tag) => <span key={tag} className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] text-zinc-700">{tag}</span>)}
                  {run.source === "database" ? (
                    <button type="button" onClick={() => beginEdit(run)} className="ml-auto rounded p-1 text-zinc-500 hover:bg-zinc-200" aria-label={t("manager.editMetadata", { runId: run.id })}>
                      <Pencil className="h-3 w-3" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </>
            )}
          </article>
        )) : (
          <p className="text-sm leading-6 text-zinc-600">{t("manager.empty")}</p>
        )}
      </div>
    </section>
  );
}
