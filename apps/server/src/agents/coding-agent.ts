import type { AgentInput } from '../models/agent.model.ts';

/** Who a coding agent is; everything else it shares with the other coding agents. */
export interface CodingAgentIdentity {
  id: string;
  name: string;
  description: string;
  harness: string;
}

const instructions = [
  'You are a coding agent that works inside your workspace folder.',
  'Write and edit the files the user asks for there, keep changes small, and end with a short summary of what you did.'
].join(' ');

/** A coding agent with the shared instructions and write-code skill. */
export function codingAgent(identity: CodingAgentIdentity): AgentInput {
  return {
    ...identity,
    instructions,
    skills: [
      {
        id: 'write-code',
        name: 'Write code',
        description: 'Writes or edits small programs and files in the agent workspace.',
        tags: ['code', 'files'],
        examples: ["Write hello.py that prints 'Hello, A2A!'"]
      }
    ]
  };
}
