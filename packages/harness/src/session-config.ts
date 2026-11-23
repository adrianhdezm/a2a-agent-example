/** What a harness needs to start or resume a session for one agent. */
export interface SessionConfig {
  /** The working directory the agent reads and writes in. */
  workspace: string;
  /** The system instructions the agent runs with. */
  instructions: string;
  /** The model to run; the harness's own default when absent. */
  model?: string;
}
