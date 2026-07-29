import type {
  ToolAction,
  ToolDefinition,
  ToolDescription,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolName,
} from "./contracts";

const definitions: ToolDescription[] = [
  {
    name: "read_file",
    version: "1.0.0",
    sideEffect: "read_only",
    description: "Read one allowlisted file from the isolated workspace.",
  },
  {
    name: "search_code",
    version: "1.0.0",
    sideEffect: "read_only",
    description: "Search allowlisted workspace files for a literal query.",
  },
  {
    name: "apply_patch",
    version: "1.0.0",
    sideEffect: "idempotent",
    description: "Replace one exact string inside an allowlisted source file.",
  },
  {
    name: "run_tests",
    version: "1.0.0",
    sideEffect: "idempotent",
    description: "Run the server-owned scenario test command.",
  },
];

function createDefinition(description: ToolDescription): ToolDefinition {
  return {
    ...description,
    execute(
      action: ToolAction,
      context: ToolExecutionContext,
    ): Promise<ToolExecutionResult> {
      if (action.tool !== description.name) {
        throw new Error(
          `Tool definition ${description.name} cannot execute ${action.tool}.`,
        );
      }
      return context.workspace.execute(action);
    },
  };
}

export class ToolRegistry {
  readonly #definitions = new Map<ToolName, ToolDefinition>();

  constructor(items: readonly ToolDefinition[] = definitions.map(createDefinition)) {
    for (const item of items) {
      if (this.#definitions.has(item.name)) {
        throw new Error(`Tool ${item.name} is already registered.`);
      }
      this.#definitions.set(item.name, item);
    }
  }

  list(): ToolDescription[] {
    return [...this.#definitions.values()].map(
      ({ name, version, sideEffect, description }) => ({
        name,
        version,
        sideEffect,
        description,
      }),
    );
  }

  execute(
    action: ToolAction,
    context: ToolExecutionContext,
  ): Promise<ToolExecutionResult> {
    const definition = this.#definitions.get(action.tool);
    if (!definition) throw new Error(`Tool ${action.tool} is not registered.`);
    return definition.execute(action, context);
  }
}
