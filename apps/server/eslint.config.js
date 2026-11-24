import { config } from '@a2a-agent-example/eslint-config';

export default [
  ...config({ tsconfigRootDir: import.meta.dirname }),
  {
    // Every handler is async for one shape, even when nothing is awaited.
    files: ['**/*.controller.ts'],
    rules: { '@typescript-eslint/require-await': 'off' }
  }
];
