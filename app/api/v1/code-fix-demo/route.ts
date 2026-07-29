import { getRecordedCodeFixDemo } from "@/lib/agentscope/execution";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await getRecordedCodeFixDemo(), {
    headers: { "cache-control": "public, max-age=300" },
  });
}
