import type { AgentEvent, AgentStage } from "../types";

const stageTitles: Record<AgentStage, string> = {
  intake: "Input intake",
  plan: "Review plan",
  inspect: "Inspection",
  finding: "Finding extraction",
  evaluate: "Harness evaluation",
  report: "Report generation",
};

export function createAgentEvent(
  stage: AgentStage,
  status: AgentEvent["status"],
  detail: string,
  options: Pick<AgentEvent, "artifact" | "durationMs"> = {},
): AgentEvent {
  return {
    id: stage,
    stage,
    status,
    title: stageTitles[stage],
    detail,
    timestamp: new Date().toISOString(),
    ...options,
  };
}
