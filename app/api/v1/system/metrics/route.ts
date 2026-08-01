import { getRuntimeMetrics } from "@/lib/agentscope/observability/runtime-metrics";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(getRuntimeMetrics(), {
    headers: { "cache-control": "no-store" },
  });
}
