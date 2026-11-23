import { describe, expect, it } from 'vitest';
import { codexCoderAgent } from '../../../src/agents/codex-coder.agent.ts';

describe('codexCoderAgent', () => {
  it('is codex-coder on the codex harness, working in its own folder of the workspaces', () => {
    expect(codexCoderAgent('/srv/workspaces')).toMatchObject({
      id: 'codex-coder',
      harness: 'codex',
      workspace: '/srv/workspaces/codex-coder'
    });
  });
});
