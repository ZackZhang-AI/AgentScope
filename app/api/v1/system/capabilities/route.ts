import { isDockerSandboxAvailable } from "@/lib/agentscope/execution";

export const dynamic = "force-dynamic";

export async function GET() {
  const storage = Boolean(process.env.DATABASE_URL);
  const docker = await isDockerSandboxAvailable();
  return Response.json(
    {
      schemaVersion: 1,
      recordedDemo: { available: true },
      sandbox: {
        available: storage && docker,
        storage,
        docker,
        reason: !storage
          ? "DATABASE_URL is not configured."
          : !docker
            ? "Docker is not available."
            : undefined,
      },
      providers: {
        fixture: { available: true },
        deepseek: {
          available: Boolean(process.env.DEEPSEEK_API_KEY),
          reason: process.env.DEEPSEEK_API_KEY
            ? undefined
            : "DEEPSEEK_API_KEY is not configured.",
        },
        minimax: {
          available: Boolean(process.env.MINIMAX_API_KEY),
          reason: process.env.MINIMAX_API_KEY
            ? undefined
            : "MINIMAX_API_KEY is not configured.",
        },
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
