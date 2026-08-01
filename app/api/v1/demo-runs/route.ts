import { demoRunCatalog } from "@/lib/agentscope/fixtures/catalog";

export const dynamic = "force-static";

export function GET() {
  return Response.json({
    schemaVersion: 1,
    runs: demoRunCatalog,
  });
}
