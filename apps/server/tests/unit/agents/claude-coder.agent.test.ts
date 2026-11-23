import { describe, expect, it } from 'vitest';
import { claudeCoderAgent } from '../../../src/agents/claude-coder.agent.ts';

describe('claudeCoderAgent', () => {
  it('is claude-coder on the claude harness, working in its own folder of the workspaces', () => {
    expect(claudeCoderAgent('/srv/workspaces')).toMatchObject({
      id: 'claude-coder',
      harness: 'claude',
      workspace: '/srv/workspaces/claude-coder'
    });
  });
});
