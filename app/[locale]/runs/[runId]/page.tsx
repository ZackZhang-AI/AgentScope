import { AdvancedRunWorkbench } from "@/components/agentscope/advanced-run-workbench";

export default async function RunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  return <AdvancedRunWorkbench initialRunId={runId} />;
}
