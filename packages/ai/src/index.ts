import Anthropic from "@anthropic-ai/sdk";

export const DEFAULT_MODEL = "claude-opus-4-6";
export const FAST_MODEL = "claude-sonnet-4-6";

export interface ToolDef<I = unknown, O = unknown> {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  run: (input: I) => Promise<O>;
}

export class ToolRegistry {
  private tools = new Map<string, ToolDef>();
  register<I, O>(t: ToolDef<I, O>) {
    this.tools.set(t.name, t as ToolDef);
  }
  list(): ToolDef[] {
    return [...this.tools.values()];
  }
  get(name: string) {
    return this.tools.get(name);
  }
}

export function makeClient(apiKey = process.env.ANTHROPIC_API_KEY) {
  return new Anthropic({ apiKey });
}

/**
 * Run a single agent turn with tool use. The caller is responsible for the loop
 * if multi-turn is needed; this keeps the wrapper minimal and SDK-agnostic.
 */
export async function runAgent(opts: {
  client: Anthropic;
  model?: string;
  system: string;
  messages: Anthropic.MessageParam[];
  tools: ToolRegistry;
}) {
  return opts.client.messages.create({
    model: opts.model ?? DEFAULT_MODEL,
    max_tokens: 2048,
    system: opts.system,
    messages: opts.messages,
    tools: opts.tools.list().map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema as Anthropic.Tool.InputSchema,
    })),
  });
}
