export type RuntimeMetric =
  | "runs_started"
  | "runs_completed"
  | "forks_started"
  | "forks_completed"
  | "trace_events_persisted"
  | "execution_errors"
  | "sse_disconnects"
  | "sse_resume_requests"
  | "replay_preflight_rejections";

type MetricState = Record<RuntimeMetric, number>;

const emptyState = (): MetricState => ({
  runs_started: 0,
  runs_completed: 0,
  forks_started: 0,
  forks_completed: 0,
  trace_events_persisted: 0,
  execution_errors: 0,
  sse_disconnects: 0,
  sse_resume_requests: 0,
  replay_preflight_rejections: 0,
});

const runtime = globalThis as typeof globalThis & {
  agentscopeRuntimeMetrics?: MetricState;
};

function state() {
  runtime.agentscopeRuntimeMetrics ??= emptyState();
  return runtime.agentscopeRuntimeMetrics;
}

export function incrementRuntimeMetric(metric: RuntimeMetric, amount = 1) {
  state()[metric] += amount;
}

export function getRuntimeMetrics() {
  return {
    schemaVersion: 1 as const,
    scope: "process" as const,
    capturedAt: new Date().toISOString(),
    counters: { ...state() },
    limitations: [
      "Counters are process-local and reset when the server instance restarts.",
    ],
  };
}

export function resetRuntimeMetricsForTests() {
  runtime.agentscopeRuntimeMetrics = emptyState();
}
