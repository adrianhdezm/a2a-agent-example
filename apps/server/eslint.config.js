import { config } from '@a2a-agent-example/eslint-config';
import { globalIgnores } from 'eslint/config';

export default [
  ...config({ tsconfigRootDir: import.meta.dirname }),
  // The agents write whatever they are asked to in their workspaces; none of it belongs to this package.
  globalIgnores(['workspaces/**'])
];
