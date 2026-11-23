import type { AgentInput } from '../models/agent.model.ts';
import { codingAgent } from './coding-agent.ts';

/** `codex-coder`: a coding agent on the `codex` harness, created when the server starts. */
export const codexCoderAgent: AgentInput = codingAgent({
  id: 'codex-coder',
  name: 'Codex Coder',
  description: 'A coding agent on the Codex SDK that writes and edits files in its workspace.',
  harness: 'codex'
});
