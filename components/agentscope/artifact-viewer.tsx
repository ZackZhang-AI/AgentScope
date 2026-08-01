"use client";

import { useEffect, useState } from "react";
import { FileDiff, FileText } from "lucide-react";
import type { Artifact } from "@/lib/agentscope/domain";
import type { StoredArtifact } from "@/lib/agentscope/execution";
import { useI18n } from "@/components/i18n-provider";

export function ArtifactViewer({ artifacts }: { artifacts: Artifact[] }) {
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState(artifacts[0]?.id);
  const [artifact, setArtifact] = useState<StoredArtifact>();
  const [error, setError] = useState<string>();
  const activeId = artifacts.some((item) => item.id === selectedId)
    ? selectedId
    : artifacts[0]?.id;

  useEffect(() => {
    const id = activeId;
    if (!id) return;
    let cancelled = false;
    fetch(`/api/v1/artifacts/${encodeURIComponent(id)}`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? t("artifact.loadError"));
        return payload.artifact as StoredArtifact;
      })
      .then((value) => {
        if (!cancelled) {
          setArtifact(value);
          setError(undefined);
        }
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : t("artifact.loadError"));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeId, t]);

  if (artifacts.length === 0) {
    return <p className="p-4 text-sm text-zinc-500">{t("artifact.none")}</p>;
  }

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto border-b border-zinc-200 bg-zinc-50 p-2">
        {artifacts.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSelectedId(item.id)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-medium ${
              activeId === item.id
                ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                : "border-zinc-200 bg-white text-zinc-600"
            }`}
          >
            {item.kind === "diff" ? (
              <FileDiff className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {item.kind}
          </button>
        ))}
      </div>
      {error ? <p className="p-4 text-xs text-red-700">{error}</p> : null}
      {!error && !artifact ? (
        <p className="p-4 text-xs text-zinc-500">{t("artifact.loading")}</p>
      ) : null}
      {artifact?.mediaType === "text/x-diff" ? (
        <pre className="max-h-[420px] overflow-auto bg-zinc-950 p-3 font-mono text-[11px] leading-5">
          {artifact.content.split("\n").map((line, index) => (
            <span
              key={`${index}-${line}`}
              className={`block ${
                line.startsWith("+")
                  ? "bg-emerald-950/70 text-emerald-200"
                  : line.startsWith("-")
                    ? "bg-red-950/70 text-red-200"
                    : "text-zinc-300"
              }`}
            >
              {line || " "}
            </span>
          ))}
        </pre>
      ) : null}
      {artifact && artifact.mediaType !== "text/x-diff" ? (
        <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap bg-zinc-950 p-4 font-mono text-xs leading-5 text-zinc-200">
          {artifact.content}
        </pre>
      ) : null}
    </div>
  );
}
