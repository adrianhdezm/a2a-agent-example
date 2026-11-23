import type { AgentDefinition } from '../models/agent.model.ts';
import { codingAgent } from './coding-agent.ts';

/** `claude-coder`: a coding agent on the `claude` harness. */
export function claudeCoderAgent(workspacesDir: string): AgentDefinition {
  return codingAgent(
    {
      id: 'claude-coder',
      name: 'Claude Coder',
      description: 'A coding agent on the Claude Agent SDK that writes and edits files in its workspace.',
      harness: 'claude'
    },
    workspacesDir
  );
}
