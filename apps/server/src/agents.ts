import { join } from 'node:path';
import type { AgentRegistry } from '@a2a-agent-example/agent-registry';

const instructions = [
  'You are a coding agent that works inside your workspace folder.',
  'Write and edit the files the user asks for there, keep changes small, and end with a short summary of what you did.'
].join(' ');

const writeCode = {
  id: 'write-code',
  name: 'Write code',
  description: 'Writes or edits small programs and files in the agent workspace.',
  tags: ['code', 'files'],
  examples: ["Write hello.py that prints 'Hello, A2A!'"]
};

/** Registers the two starter agents, `claude-coder` and `codex-coder`, each with a workspace under `workspacesDir`. */
export function registerStarterAgents(agents: AgentRegistry, workspacesDir: string): void {
  agents.register({
    id: 'claude-coder',
    name: 'Claude Coder',
    description: 'A coding agent on the Claude Agent SDK that writes and edits files in its workspace.',
    harness: 'claude',
    instructions,
    workspace: join(workspacesDir, 'claude-coder'),
    skills: [writeCode]
  });
  agents.register({
    id: 'codex-coder',
    name: 'Codex Coder',
    description: 'A coding agent on the Codex SDK that writes and edits files in its workspace.',
    harness: 'codex',
    instructions,
    workspace: join(workspacesDir, 'codex-coder'),
    skills: [writeCode]
  });
}
