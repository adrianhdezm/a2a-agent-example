import type { AgentDefinition } from '../models/agent.model.ts';
import { codingAgent } from './coding-agent.ts';

/** `codex-coder`: a coding agent on the `codex` harness. */
export function codexCoderAgent(workspacesDir: string): AgentDefinition {
  return codingAgent(
    {
      id: 'codex-coder',
      name: 'Codex Coder',
      description: 'A coding agent on the Codex SDK that writes and edits files in its workspace.',
      harness: 'codex'
    },
    workspacesDir
  );
}
