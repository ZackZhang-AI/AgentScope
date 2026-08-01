import {
  getExecutionProfile,
  isDockerSandboxAvailable,
} from "@/lib/agentscope/execution";

export const dynamic = "force-dynamic";

export async function resolveCapabilities(
  env: Record<string, string | undefined> = process.env,
  dockerCheck: () => Promise<boolean> = isDockerSandboxAvailable,
) {
  const executionProfile = getExecutionProfile(env);
  const sandboxEnabled = executionProfile === "local_sandbox";
  const storage = Boolean(env.DATABASE_URL);
  const docker = sandboxEnabled ? await dockerCheck() : false;
  const disabledReason =
    executionProfile === "recorded_only"
      ? "Sandbox execution is disabled on this public showcase."
      : undefined;

  return {
    schemaVersion: 1,
    executionProfile,
    recordedDemo: { available: true },
    sandbox: {
      available: sandboxEnabled && storage && docker,
      storage,
      docker,
      reason: disabledReason ?? (!storage
        ? "DATABASE_URL is not configured."
        : !docker
          ? "Docker is not available."
          : undefined),
    },
    providers: {
      fixture: {
        available: sandboxEnabled,
        reason: disabledReason,
      },
      deepseek: {
        available: sandboxEnabled && Boolean(env.DEEPSEEK_API_KEY),
        reason: disabledReason ?? (env.DEEPSEEK_API_KEY
          ? undefined
          : "DEEPSEEK_API_KEY is not configured."),
      },
      minimax: {
        available: sandboxEnabled && Boolean(env.MINIMAX_API_KEY),
        reason: disabledReason ?? (env.MINIMAX_API_KEY
          ? undefined
          : "MINIMAX_API_KEY is not configured."),
      },
    },
  };
}

export async function GET() {
  return Response.json(
    await resolveCapabilities(),
    { headers: { "cache-control": "no-store" } },
  );
}
