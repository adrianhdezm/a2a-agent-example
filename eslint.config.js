import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['**/node_modules/**', '**/coverage/**', '**/.cache/**', '**/*.tsbuildinfo']),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        // src/ belongs to tsconfig.app.json; tests/ and this file to tsconfig.node.json.
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  prettier,
  {
    rules: {
      // Correctness
      curly: 'error',
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      'max-classes-per-file': ['error', 1],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true
        }
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',

      // Complexity and size guardrails
      complexity: ['warn', 10],
      'max-depth': ['warn', 4],
      'max-lines-per-function': ['warn', 75],
      'max-statements': ['warn', 20],
      'max-params': ['warn', 4],
      'max-nested-callbacks': ['warn', 3],
      'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }],

      // Clarity and simplicity
      'no-else-return': 'warn',
      'no-nested-ternary': 'warn',
      'no-unneeded-ternary': 'warn'
    }
  },
  {
    // The agent and its client meet only over A2A: neither imports the other, and both may import shared/.
    files: ['src/server/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['**/client/**'], message: 'The server never imports the client; move what both need to src/shared/.' }] }
      ]
    }
  },
  {
    files: ['src/client/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['**/server/**'], message: 'The client never imports the server; move what both need to src/shared/.' }] }
      ]
    }
  },
  {
    // shared/ is what the server and the client both use, so it depends on neither.
    files: ['src/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['**/server/**', '**/client/**'], message: 'shared/ depends on neither the server nor the client.' }] }
      ]
    }
  },
  {
    // A describe holds every case for one module, so the size guardrails do not apply, and tests may assert.
    files: ['tests/**/*.ts'],
    rules: {
      'max-lines-per-function': 'off',
      'max-nested-callbacks': 'off',
      'max-statements': 'off',
      '@typescript-eslint/consistent-type-assertions': 'off'
    }
  }
);
