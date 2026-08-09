import { Check, Circle, LockKeyhole } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

export const demoSteps = [
  { id: "failure", labelKey: "demo.failure", detailKey: "demo.failureDetail" },
  { id: "root-cause", labelKey: "demo.rootCause", detailKey: "demo.rootCauseDetail" },
  { id: "fork", labelKey: "demo.fork", detailKey: "demo.forkDetail" },
  { id: "verified", labelKey: "demo.verified", detailKey: "demo.verifiedDetail" },
] as const;

export type DemoStepId = (typeof demoSteps)[number]["id"];
export type DemoStage = "intro" | DemoStepId;

type DemoProgressProps = {
  current: DemoStage;
  highestStep: number;
  onSelect: (step: DemoStepId) => void;
};

export function DemoProgress({ current, highestStep, onSelect }: DemoProgressProps) {
  const { t } = useI18n();
  const currentIndex = demoSteps.findIndex((step) => step.id === current);
  const activeStep = demoSteps[currentIndex];
  return (
    <nav
      className="border-b border-zinc-200 bg-zinc-950 text-white"
      aria-label={t("demo.progressLabel")}
    >
      <div className="mx-auto max-w-5xl px-4 py-3 sm:hidden">
        <div className="flex items-center justify-between gap-4 text-xs">
          <span className="font-semibold">
            {activeStep ? t(activeStep.labelKey) : t("demo.ready")}
          </span>
          <span className="font-mono text-zinc-400">
            {Math.max(0, currentIndex + 1)}/4
          </span>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1" aria-hidden="true">
          {demoSteps.map((step, index) => (
            <span
              key={step.id}
              className={`h-1 rounded-sm ${index <= currentIndex ? "bg-emerald-400" : "bg-zinc-700"}`}
            />
          ))}
        </div>
      </div>
      <ol className="mx-auto hidden max-w-5xl grid-cols-4 px-4 sm:grid lg:px-6">
        {demoSteps.map((step, index) => {
          const label = t(step.labelKey);
          const detail = t(step.detailKey);
          const complete = index < currentIndex;
          const active = step.id === current;
          const enabled = index <= highestStep;
          return (
            <li
              key={step.id}
              aria-current={active ? "step" : undefined}
              className={`border-zinc-800 sm:border-r sm:last:border-r-0 ${
                active ? "bg-zinc-900" : ""
              }`}
            >
              <button
                type="button"
                disabled={!enabled}
                onClick={() => onSelect(step.id)}
                className="flex h-full w-full gap-2 px-3 py-3 text-left disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`${label}: ${detail}`}
              >
                {complete ? (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                ) : enabled ? (
                  <Circle
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      active ? "text-emerald-400" : "text-zinc-500"
                    }`}
                    aria-hidden="true"
                  />
                ) : (
                  <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-zinc-600" aria-hidden="true" />
                )}
                <span>
                  <span className="block text-xs font-semibold">{label}</span>
                  <span className="mt-0.5 hidden text-[10px] leading-4 text-zinc-400 lg:block">
                    {detail}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
