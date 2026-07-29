import type {
  AgentAction,
  DecisionContext,
  DecisionProvider,
  DecisionResult,
} from "./contracts";

const incompletePatch = {
  type: "tool",
  tool: "apply_patch",
  input: {
    path: "src/auth.ts",
    search: "return session.userId === targetUserId;",
    replacement: "return session.userId === targetUserId;",
  },
  rationale: "Apply the smallest possible authorization change.",
} satisfies AgentAction;

const parentActions: AgentAction[] = [
  {
    type: "tool",
    tool: "read_file",
    input: { path: "src/auth.ts" },
    rationale: "Read the authorization implementation before changing it.",
  },
  {
    type: "tool",
    tool: "search_code",
    input: { query: "canDeleteUser", path: "src" },
    rationale: "Find the implementation and its test coverage.",
  },
  incompletePatch,
  {
    type: "tool",
    tool: "run_tests",
    input: {},
    rationale: "Validate the attempted authorization fix.",
  },
  {
    type: "tool",
    tool: "run_tests",
    input: {},
    rationale: "Retry the same failing test without changing workspace state.",
  },
  {
    type: "tool",
    tool: "run_tests",
    input: {},
    rationale: "Retry once more even though no new evidence was produced.",
  },
  {
    type: "finish",
    outcome: "error",
    summary:
      "The parent agent exhausted its attempts after repeating the same failing test without workspace progress.",
  },
];

const repairActions: AgentAction[] = [
  {
    type: "tool",
    tool: "read_file",
    input: { path: "src/auth.ts" },
    rationale: "Restore the checkpoint and inspect the exact authorization rule.",
  },
  {
    type: "tool",
    tool: "apply_patch",
    input: {
      path: "src/auth.ts",
      search: "return session.userId === targetUserId;",
      replacement:
        'return session.role === "admin" || session.userId === targetUserId;',
    },
    rationale:
      "Allow admins while preserving the existing owner-only behavior for normal users.",
  },
  {
    type: "tool",
    tool: "run_tests",
    input: {},
    rationale: "Verify both the admin and normal-user authorization cases.",
  },
  {
    type: "finish",
    outcome: "success",
    summary:
      "The child agent applied a scoped authorization fix and the target tests passed.",
  },
];

export class FixtureDecisionProvider implements DecisionProvider {
  readonly id = "fixture" as const;

  constructor(private readonly profile: "parent" | "repair" = "parent") {}

  async next(context: DecisionContext): Promise<DecisionResult> {
    const actions = this.profile === "parent" ? parentActions : repairActions;
    const action = actions[context.step] ?? actions.at(-1);
    if (!action) throw new Error("Fixture decision profile has no actions.");

    return {
      action,
      model: `fixture-${this.profile}-v1`,
      durationMs: 1,
      tokenUsage: {
        inputTokens: 12 + context.step,
        outputTokens: 8,
        totalTokens: 20 + context.step,
      },
    };
  }
}
