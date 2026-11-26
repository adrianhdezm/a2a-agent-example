import { config } from '@a2a-agent-example/eslint-config';

// The agents know nothing of the Express app that serves them: no Express packages, and none of its blocks.
const expressSide = {
  paths: ['express', 'cors', 'http-errors', 'pino-http'],
  patterns: [
    {
      group: ['**/app.ts', '**/server.ts', '**/controllers/**', '**/middlewares/**', '**/app-context.model.ts', '**/config.*.ts'],
      message: 'An agent must not depend on the Express app; server.ts hands it what it needs.'
    }
  ]
};

/**
 * no-restricted-imports set by a later entry replaces an earlier one, so each group repeats the Express ban.
 * @param {...{ regex: string, message: string }} patterns
 */
function agentImports(...patterns) {
  return { 'no-restricted-imports': ['error', { paths: expressSide.paths, patterns: [...expressSide.patterns, ...patterns] }] };
}

export default [
  ...config({ tsconfigRootDir: import.meta.dirname }),
  {
    // Every handler is async for one shape, even when nothing is awaited.
    files: ['**/*.controller.ts'],
    rules: { '@typescript-eslint/require-await': 'off' }
  },
  {
    // The app reaches an agent only through its entry point, <name>.agent.ts; core and the agent's blocks stay inside.
    files: ['src/**/*.ts'],
    ignores: ['src/agents/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: String.raw`(^|/)agents/(?![^/]+/[^/]+\.agent\.ts$)`,
              message: 'The app reaches an agent only through its <name>.agent.ts, which hands back everything needed to serve it.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/agents/**/*.ts'],
    rules: agentImports()
  },
  {
    // core serves every agent, so it imports none: from core/<block>/, nothing under ../../ but the shared logger.
    files: ['src/agents/core/**/*.ts'],
    rules: agentImports({ regex: String.raw`^\.\./\.\./(?!\.\./)`, message: 'core serves every agent, so it imports none of them.' })
  },
  {
    // An agent imports core and itself, never another agent.
    files: ['src/agents/*/*/**/*.ts'],
    ignores: ['src/agents/core/**'],
    rules: agentImports({ regex: String.raw`^\.\./\.\./(?!core/|\.\./)`, message: 'An agent imports core, never another agent.' })
  },
  {
    files: ['src/agents/*/*.ts'],
    ignores: ['src/agents/core/**'],
    rules: agentImports({ regex: String.raw`^\.\./(?!core/|\.\./)`, message: 'An agent imports core, never another agent.' })
  }
];
