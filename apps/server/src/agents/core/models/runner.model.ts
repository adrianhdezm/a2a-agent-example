import type { z } from 'zod';
import type { TurnEvent, TurnRequest } from './turn.model.ts';

/** What a tool is told about the call: the A2A context it runs in, and the signal that aborts the turn. */
export interface ToolContext {
  contextId: string;
  signal: AbortSignal;
}

/**
 * A tool, defined once for every runner: its name and description for the model, its input as a zod object, and what
 * it does. It answers in text; a `ToolError` goes back to the model as a failed call it can explain, and any other
 * error is a bug and ends the turn.
 */
export interface AgentTool<Input extends z.ZodObject = z.ZodObject> {
  name: string;
  description: string;
  input: Input;
  // A method, not a property, so a tool with a narrower input still fits a list of tools.
  run(input: z.infer<Input>, context: ToolContext): Promise<string>;
}

/** A failure a tool reports to the model, such as a service that refused, rather than a bug. */
export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolError';
  }
}

/** What an agent is, the same whichever runner runs it: its instructions, its tools, and how far one turn may go. */
export interface AgentSpec {
  /** The instructions, built per turn so they can carry today's date. */
  instructions: (now: Date) => string;
  tools: AgentTool[];
  /** The most model round trips one turn may take. */
  maxSteps: number;
}

/**
 * What a runner runs: the agent's spec, and where its tools are served over MCP for an SDK that cannot run them in
 * this process.
 */
export interface TurnAgent extends AgentSpec {
  toolsUrl: (contextId: string) => string;
}

/**
 * The strategy every agent SDK is adapted to. A runner runs one turn of an agent and reports it as turn events: its
 * text before tool calls and the calls as progress, the session to resume, and a structured `{ outcome, text }` answer.
 * It gives the model the agent's tools and nothing else, loads none of the machine's settings, and stops when the
 * request is aborted. It knows nothing of A2A.
 */
export interface Runner {
  readonly name: string;
  runTurn: (agent: TurnAgent, request: TurnRequest) => AsyncIterable<TurnEvent>;
}

/** A runner as configuration names it: `claude`, `codex` or `pi`, and the model, which Pi needs and the others may take. */
export interface RunnerConfig {
  name: string;
  model?: string;
}
