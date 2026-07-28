import type { RunProjection, TraceEvent } from "../domain";

export type AppendTraceResult = {
  inserted: number;
  duplicates: number;
  projection: RunProjection;
};

export type RunSummary = {
  id: string;
  projectId: string;
  name: string;
  status: RunProjection["run"]["status"];
  taskType: string;
  provider: string;
  model?: string;
  parentRunId?: string;
  forkedFromSpanId?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  spanCount: number;
  errorCount: number;
};

export type ListRunsInput = {
  projectId?: string;
  status?: RunProjection["run"]["status"];
  limit?: number;
};

export interface TraceRepository {
  append(event: TraceEvent): Promise<AppendTraceResult>;
  appendMany(events: readonly TraceEvent[]): Promise<AppendTraceResult>;
  getProjection(runId: string): Promise<RunProjection | null>;
  listEventsAfter(runId: string, sequence: number): Promise<TraceEvent[]>;
  listRuns(input?: ListRunsInput): Promise<RunSummary[]>;
}
