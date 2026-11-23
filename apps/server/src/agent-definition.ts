/** One thing an agent can do, as its Agent Card advertises it. */
export interface AgentSkillDefinition {
  id: string;
  name: string;
  description: string;
  tags: string[];
  /** Prompts that show what the skill is for. */
  examples: string[];
}

/** An agent as configuration: who it is, which harness runs it, and where it works. */
export interface AgentDefinition {
  /** A URL-safe slug: lowercase letters, digits and single hyphens. It names the agent's endpoints. */
  id: string;
  name: string;
  description: string;
  /** The name of a harness in the `HarnessRegistry`. */
  harness: string;
  instructions: string;
  /** The working directory the agent reads and writes in. */
  workspace: string;
  /** The model to run; the harness's own default when absent. */
  model?: string;
  skills: AgentSkillDefinition[];
}
