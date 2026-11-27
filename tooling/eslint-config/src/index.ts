import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import tseslint from 'typescript-eslint';

export interface ConfigOptions {
  /** The directory of the package's `tsconfig.json`: pass `import.meta.dirname` from its `eslint.config.js`. */
  tsconfigRootDir: string;
}

/**
 * The `no-restricted-syntax` entries every package gets: steps hidden inside an expression are hard to read and to
 * debug, so each gets a name first. A package that sets its own `no-restricted-syntax` replaces them, so it spreads
 * these into its own list.
 */
export const restrictedSyntax = [
  {
    // An awaited result passed straight into a call hides a step that can take long and fail.
    selector: 'CallExpression > AwaitExpression.arguments, NewExpression > AwaitExpression.arguments',
    message: 'Await into a named const first, then pass the const.'
  },
  {
    // A loop head that builds its iterable hides the work the loop starts; a call with no arguments (map.values()) is fine.
    selector: 'ForOfStatement > CallExpression.right[arguments.length>0]',
    message: 'Name what the loop iterates in a const first, then loop over the const.'
  }
];

/** The house ESLint config for one package: typed rules through its own tsconfig projects, and the shared rules. */
export function config({ tsconfigRootDir }: ConfigOptions) {
  return defineConfig(
    globalIgnores(['**/node_modules/**', '**/coverage/**', '**/.cache/**', '**/*.tsbuildinfo']),
    js.configs.recommended,
    tseslint.configs.strictTypeChecked,
    tseslint.configs.stylisticTypeChecked,
    {
      languageOptions: {
        parserOptions: {
          // src/ belongs to tsconfig.app.json; tests/ and this file to tsconfig.node.json.
          projectService: true,
          tsconfigRootDir
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

        // Complexity and size guardrails: they flag code to look at, not code to split. ESLint's complexity counts every
        // case, ?? and ?., so a flat switch reaches 10 while it is the easiest form to read. Function length is
        // max-lines-per-function's job, so statements are not counted as well.
        complexity: ['warn', 15],
        'max-depth': ['warn', 4],
        'max-lines-per-function': ['warn', { max: 80, skipBlankLines: true, skipComments: true }],
        'max-params': ['warn', 4],
        'max-nested-callbacks': ['warn', 3],
        'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }],

        // Clarity and simplicity
        'no-else-return': 'warn',
        'no-nested-ternary': 'warn',
        'no-unneeded-ternary': 'warn',
        'no-restricted-syntax': ['error', ...restrictedSyntax]
      }
    },
    {
      // A describe holds every case for one module, so the size guardrails do not apply, tests may assert, and
      // expect(await …) is the test runner's own idiom.
      files: ['tests/**/*.ts'],
      rules: {
        'max-lines-per-function': 'off',
        'max-nested-callbacks': 'off',
        '@typescript-eslint/consistent-type-assertions': 'off',
        'no-restricted-syntax': 'off'
      }
    }
  );
}
