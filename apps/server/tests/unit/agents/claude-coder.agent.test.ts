import { describe, expect, it } from 'vitest';
import { claudeCoderAgent } from '../../../src/agents/claude-coder.agent.ts';
import { createAgentSchema } from '../../../src/models/agent.model.ts';

describe('claudeCoderAgent', () => {
  it('is claude-coder on the claude harness, valid as a POST /agents body', () => {
    expect(claudeCoderAgent).toMatchObject({ id: 'claude-coder', harness: 'claude' });
    expect(createAgentSchema.safeParse(claudeCoderAgent).success).toBe(true);
  });
});
