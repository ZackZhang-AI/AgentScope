import { z } from "zod";

export const executionProfileSchema = z.enum([
  "recorded_only",
  "local_sandbox",
]);

export type ExecutionProfile = z.infer<typeof executionProfileSchema>;

type ExecutionEnvironment = Record<string, string | undefined>;

export function getExecutionProfile(
  env: ExecutionEnvironment = process.env,
): ExecutionProfile {
  const configured = executionProfileSchema.safeParse(
    env.AGENTSCOPE_EXECUTION_PROFILE,
  );
  if (configured.success) return configured.data;

  return env.NODE_ENV === "development" || env.NODE_ENV === "test"
    ? "local_sandbox"
    : "recorded_only";
}

export function isSandboxExecutionEnabled(
  env?: ExecutionEnvironment,
) {
  return getExecutionProfile(env) === "local_sandbox";
}

export function sandboxDisabledResponse() {
  return Response.json(
    {
      code: "SANDBOX_DISABLED",
      error:
        "Sandbox execution is disabled by this deployment profile. Use the recorded demo.",
    },
    { status: 503 },
  );
}
