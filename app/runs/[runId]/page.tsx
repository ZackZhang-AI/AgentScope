import { CodeFixWorkbench } from "@/components/agentscope/code-fix-workbench";

export default async function RunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  return <CodeFixWorkbench initialRunId={runId} />;
}
