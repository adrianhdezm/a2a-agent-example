import { describe, expect, it } from 'vitest';
import { codexCoderAgent } from '../../../src/agents/codex-coder.agent.ts';
import { createAgentSchema } from '../../../src/models/agent.model.ts';

describe('codexCoderAgent', () => {
  it('is codex-coder on the codex harness, valid as a POST /agents body', () => {
    expect(codexCoderAgent).toMatchObject({ id: 'codex-coder', harness: 'codex' });
    expect(createAgentSchema.safeParse(codexCoderAgent).success).toBe(true);
  });
});
