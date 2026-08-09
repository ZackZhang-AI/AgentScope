import type { DemoStage } from "./demo-progress";

export const demoStages: DemoStage[] = [
  "intro",
  "failure",
  "root-cause",
  "fork",
  "verified",
];

type SearchParamsReader = {
  get(name: string): string | null;
};

export function parseDemoStage(searchParams: SearchParamsReader): DemoStage {
  if (searchParams.get("view") === "verified") return "verified";
  const step = searchParams.get("step");
  return demoStages.includes(step as DemoStage) ? step as DemoStage : "intro";
}

export function demoStageProgress(stage: DemoStage) {
  return Math.max(-1, demoStages.indexOf(stage) - 1);
}

export function nextDemoStage(stage: DemoStage): DemoStage | undefined {
  const index = demoStages.indexOf(stage);
  return index >= 0 ? demoStages[index + 1] : undefined;
}
