import { describe, expect, it } from 'vitest';
import { parseCommand } from '../src/args.ts';
import { UsageError } from '../src/errors/usage-error.ts';

describe('parseCommand', () => {
  describe('ask', () => {
    it('reads the agent id and the prompt, joining an unquoted prompt from the words after the id', () => {
      expect(parseCommand(['ask', 'codex-coder', 'Write', 'hello.py'])).toEqual({
        name: 'ask',
        agentId: 'codex-coder',
        prompt: 'Write hello.py'
      });
    });

    it.each([[['ask']], [['ask', 'claude-coder']], [['ask', 'claude-coder', '  ']]])('throws a UsageError for %j', (args) => {
      expect(() => parseCommand(args)).toThrow(UsageError);
    });
  });

  describe('agents', () => {
    it.each([
      ['list', 'list-agents'],
      ['seed', 'seed-agents']
    ])('reads agents %s', (subcommand, name) => {
      expect(parseCommand(['agents', subcommand])).toEqual({ name });
    });

    it('reads agents create with every option', () => {
      const args = [
        'agents',
        'create',
        'py-tester',
        '--harness',
        'claude',
        '--instructions',
        'Write pytest tests.',
        '--name',
        'Python Tester'
      ];

      expect(parseCommand([...args, '--description', 'Tests Python.', '--model', 'claude-sonnet-5-5'])).toEqual({
        name: 'create-agent',
        agent: {
          id: 'py-tester',
          name: 'Python Tester',
          description: 'Tests Python.',
          harness: 'claude',
          instructions: 'Write pytest tests.',
          model: 'claude-sonnet-5-5',
          skills: []
        }
      });
    });

    it('names the agent after its id and describes it by its harness when those are left out', () => {
      expect(parseCommand(['agents', 'create', 'py-tester', '--harness', 'codex', '--instructions', 'Write tests.'])).toMatchObject({
        agent: { name: 'py-tester', description: 'py-tester, an agent on the codex harness' }
      });
    });

    it.each([
      [['agents', 'create', 'py-tester', '--instructions', 'Write tests.']],
      [['agents', 'create', 'py-tester', '--harness', 'claude']],
      [['agents', 'create', '--harness', 'claude', '--instructions', 'Write tests.']],
      [['agents', 'create', 'a', 'b', '--harness', 'claude', '--instructions', 'Write tests.']]
    ])('throws a UsageError for %j', (args) => {
      expect(() => parseCommand(args)).toThrow(UsageError);
    });
  });

  it.each([[[]], [['agents']], [['agents', 'list', 'extra']], [['agents', 'seed', 'now']], [['deploy']]])(
    'throws a UsageError for the unknown command %j',
    (args) => {
      expect(() => parseCommand(args)).toThrow(UsageError);
    }
  );
});
