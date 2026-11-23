import { config } from '@a2a-agent-example/eslint-config';
import { globalIgnores } from 'eslint/config';

export default [
  ...config({ tsconfigRootDir: import.meta.dirname }),
  // The agents write whatever they are asked to in their workspaces; none of it belongs to this package.
  globalIgnores(['workspaces/**']),
  {
    // Every handler is async for one shape, even when nothing is awaited.
    files: ['**/*.controller.ts'],
    rules: { '@typescript-eslint/require-await': 'off' }
  }
];
