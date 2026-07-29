import { compareRuns } from "../compare/compare-runs";
import { diagnoseRun } from "../diagnostics/diagnose-run";
import { evaluateRun } from "../eval/evaluate-run";
import type { TraceEvent } from "../domain";
import {
  CodeFixRunExecutor,
} from "./code-fix-run-executor";
import type {
  CodeFixRunResult,
  StoredArtifact,
} from "./contracts";
import { MemoryArtifactStore } from "./artifact-store";
import { FixtureDecisionProvider } from "./fixture-decision-provider";
import { MemoryCodeFixWorkspace } from "./memory-workspace";
import { buggyAuthApiScenario } from "./scenario";

export type RecordedCodeFixRun = {
  result: CodeFixRunResult;
  events: TraceEvent[];
  artifacts: StoredArtifact[];
};

export type RecordedCodeFixDemo = {
  kind: "agentscope.code-fix-demo";
  version: 1;
  parent: RecordedCodeFixRun;
  child: RecordedCodeFixRun;
  diagnostics: ReturnType<typeof diagnoseRun>;
  parentEval: ReturnType<typeof evaluateRun>;
  childEval: ReturnType<typeof evaluateRun>;
  comparison: ReturnType<typeof compareRuns>;
};

async function executeRecorded(
  profile: "parent" | "repair",
  id: string,
  store: MemoryArtifactStore,
  initialFiles?: Record<string, string>,
  branch?: { parentRunId: string; forkedFromSpanId: string },
) {
  const events: TraceEvent[] = [];
  let result: CodeFixRunResult | undefined;
  for await (const message of new CodeFixRunExecutor(
    undefined,
    () => id,
  ).execute({
    request: {
      taskType: "code_fix",
      scenarioId: "buggy-auth-api",
      executionMode: "recorded",
      decisionProvider: "fixture",
    },
    provider: new FixtureDecisionProvider(profile),
    workspace: new MemoryCodeFixWorkspace(
      buggyAuthApiScenario,
      initialFiles,
    ),
    artifactStore: store,
    branch,
  })) {
    if (message.type === "trace_event") events.push(message.event);
    if (message.type === "result") result = message.result;
  }
  if (!result) throw new Error("Recorded code-fix run did not complete.");
  return {
    result,
    events,
    artifacts: store.listForRun(id, "user"),
  };
}

let demoPromise: Promise<RecordedCodeFixDemo> | undefined;

export function getRecordedCodeFixDemo() {
  demoPromise ??= (async () => {
    const store = new MemoryArtifactStore((input) =>
      [
        "artifact",
        input.runId,
        input.spanId ?? "run",
        input.kind,
      ]
        .join("_")
        .replace(/[^a-zA-Z0-9:_-]/g, "_"),
    );
    const parent = await executeRecorded(
      "parent",
      "codefix_demo_parent",
      store,
    );
    const forkSpanId = "codefix_demo_parent:tool:4";
    const checkpoint = parent.result.trace.checkpoints.find(
      (item) =>
        item.id === parent.result.trace.spans.find(
          (span) => span.id === forkSpanId,
        )?.replayability?.checkpointId,
    );
    const snapshotId = checkpoint?.stateRef.replace("artifact://", "");
    const snapshot = snapshotId ? await store.get(snapshotId) : null;
    const initialFiles = snapshot
      ? JSON.parse(snapshot.content) as Record<string, string>
      : undefined;
    const child = await executeRecorded(
      "repair",
      "codefix_demo_child",
      store,
      initialFiles,
      {
        parentRunId: parent.result.id,
        forkedFromSpanId: forkSpanId,
      },
    );
    return {
      kind: "agentscope.code-fix-demo",
      version: 1,
      parent,
      child,
      diagnostics: diagnoseRun(parent.result.trace),
      parentEval: evaluateRun(parent.result.trace),
      childEval: evaluateRun(child.result.trace),
      comparison: compareRuns(parent.result.trace, child.result.trace),
    };
  })();
  return demoPromise;
}

export async function getRecordedArtifact(artifactId: string) {
  const demo = await getRecordedCodeFixDemo();
  return [...demo.parent.artifacts, ...demo.child.artifacts].find(
    (artifact) => artifact.id === artifactId,
  ) ?? null;
}
