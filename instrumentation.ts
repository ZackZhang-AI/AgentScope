export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.DATABASE_URL) return;

  const staleAfterMs = Number.parseInt(
    process.env.AGENTSCOPE_INTERRUPTED_AFTER_MS ?? "300000",
    10,
  );
  const thresholdMs = Number.isFinite(staleAfterMs)
    ? Math.max(staleAfterMs, 30_000)
    : 300_000;
  const recoveredAt = new Date();
  const staleBefore = new Date(recoveredAt.getTime() - thresholdMs);

  try {
    const [{ recoverInterruptedRuns }, { getTraceRepository }] = await Promise.all([
      import("./lib/agentscope/application/recover-interrupted-runs"),
      import("./lib/agentscope/infrastructure/postgres/database"),
    ]);
    const result = await recoverInterruptedRuns(getTraceRepository(), {
      staleBefore: staleBefore.toISOString(),
      recoveredAt: recoveredAt.toISOString(),
    });

    if (result.recoveredRunIds.length > 0 || result.failedRunIds.length > 0) {
      console.info("[AgentScope] interrupted run recovery", result);
    }
  } catch (error) {
    console.error("[AgentScope] interrupted run recovery failed", error);
  }
}
