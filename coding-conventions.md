# Coding Conventions

How this project is built and how to change it: a Node package project, following the
`consult-stack-knowledge` skill's blueprint for that stack. It is the working guide for everyone who changes the code, people and agents
alike. The code follows every rule here; a change that breaks one changes this file in the same commit.

## Contents

- [Node package](#node-package)
- [Code style](#code-style)
- [pnpm](#pnpm)
- [TypeScript](#typescript)
- [Node](#node)
- [Node + TypeScript](#node--typescript)
- [ESLint](#eslint)
- [TypeScript + ESLint](#typescript--eslint)
- [Prettier](#prettier)
- [ESLint + Prettier](#eslint--prettier)
- [Testing](#testing)
- [Vitest](#vitest)

## Node package

### Layout

| Path                     | Holds                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| `src/main.ts`            | the entry point, the one file with side effects (Node says why)                            |
| `src/<module>.ts`        | exports only                                                                               |
| `src/errors/`            | error classes with a name the caller can check                                             |
| `tests/<module>.test.ts` | one per module in `src/`, same base name, importing from `../src/….ts`; `main.ts` has none |

### Values and control flow

- **`undefined`, not `null`, for absence**, except where an external format (JSON, a provider API) says otherwise.

### Lint

- **No type assertions in `src/`** (`consistent-type-assertions: never`): narrow with a type guard. The one accepted
  exception is a library that offers no other way, with `// eslint-disable-next-line` and a reason.
- **One class per file.** **Warnings fail the check** (`--max-warnings 0`).

### Commands

`pnpm start` runs the program, `pnpm dev` reruns it on change; `pnpm typecheck`, `pnpm lint`, `pnpm test` and
`pnpm format:check` are the four required checks.

### Into an existing project

Move sources under `src/` and tests under `tests/`, or adjust the two `include` arrays.

### Growing into a workspace

The pieces to move are exactly the ones inlined here: versions into the catalog, the ESLint rules into a
`tooling/eslint-config` package exporting `config({ tsconfigRootDir })`, the compiler options into a `tooling/tsconfig`
package with a base file, and the scripts into root `pnpm -r` rollups.

## Code style

- **Comments explain why, and only where the code cannot**; doc comments on exports say what the thing is or does; never
  restate the code.
- **Named exports only**, except where a tool requires a default export (a file a tool loads by convention, as its
  technology doc says).
- **Split a function or file when a size limit fires**; never raise the limit.
- **Every suppression says why**, next to where it applies, as narrowly as possible.
- **Handle absence; never assert it away.**
- **Narrow with checks instead of casting**; tests may assert.
- **Closed sets are literal values**, never a separate runtime construct.
- **An intentionally unused name starts with `_`.**
- **`Promise.all` for independent async work**; `for … of` with `await` only where order matters.

## pnpm

- **pnpm only**: `pnpm add`, `pnpm exec`, `pnpm dlx`; never npm, npx or yarn. The version is the root
  `packageManager` field.
- **Approve install scripts in `pnpm-workspace.yaml`'s `allowBuilds`** when a new dependency asks: `true` if it must be
  built, `false` if it may be skipped.
- **In a workspace, the catalog holds only what two or more packages share at the same range**; everything else is a
  direct dependency of the package that uses it.
- **Held-back versions stay held until their reason goes**, each where its own doc says why.
- **Script names are the same everywhere**: `dev`, `build`, `typecheck`, `lint`, `test`, `format`, `format:check`.
  Never name a script after a pnpm command (`up`, `update`, `add`, `install`, `deploy`).

## TypeScript

- **`pnpm typecheck` is the type check**: `tsc -b` over every project, after generating the types the code imports.
- **TypeScript is pinned exactly** on 6.0.x; move it only when every tool that reads it accepts the new version.
- **Each runtime is its own project.** A new config file goes into `tsconfig.node.json`'s `include`; a new folder of
  sources goes into the project of the runtime that runs it.
- **`array[0]` is `T | undefined`**; handle it, and never silence it with a non-null assertion (`!`).
- **Type guards over type assertions** (`as`) in sources; tests may assert.
- **`import type` for types**, so nothing type-only reaches the output.
- **No `enum`, `namespace`, parameter properties or `import x = require()`**: use `as const` objects and unions.
- **Never write a type that mirrors a generated file**: infer it.

## Node

- **Node 24 or newer.** ([Node.js release schedule](https://github.com/nodejs/release#release-schedule))
- **The environment comes from the root `.env`** (git-ignored; `.env.example` is committed and lists every variable).
  A missing `.env` or a missing required variable fails at start; there are no fallback values for configuration.
- **The entry point is the only file with side effects**; everything else exports, and is tested through its exports.

## Node + TypeScript

- **Code Node runs as TypeScript imports with the `.ts` extension**, keeps type imports in their own `import type`
  statement, and avoids syntax Node cannot strip.
- **Code compiled by `tsc` for Node imports with the `.js` extension.**

## ESLint

- **`pnpm lint` reports code problems**; formatting is not its job.
- **Always braces** (`curly`), even around a one-line body.
- **Size guardrails warn** (complexity 10, depth 4, 75 lines per function, 20 statements, 4 parameters, 400 lines per
  file, 3 nested callbacks): split rather than raise the limit.
- **An override is per folder or file pattern, with a comment saying why**, never a blanket `eslint-disable` at the top
  of a file. A single-line disable names the rule and carries its reason.
- **Generated and vendored code is ignored**, never patched with overrides.
- **A deprecated import is forbidden with `no-restricted-imports`**, its `message` naming the replacement.

## TypeScript + ESLint

- **Lint runs with type information.** A new file must belong to a TypeScript project, or ESLint reports it.
- **TypeScript moves only when typescript-eslint's peer range accepts the new version.**
- **No non-null assertions, type-only imports marked `type`, unused names prefixed `_`**: the shared typed rules enforce
  them.

## Prettier

- **Prettier formats everything**: run `pnpm format` before committing; `pnpm format:check` fails on anything it would
  change. Single quotes, 140 columns, no trailing commas.
- **Never format by hand** or reformat a file you are not changing.
- **Generated and vendored files are ignored**, never reformatted.

## ESLint + Prettier

- **Formatting problems never reach `pnpm lint`**: `eslint-config-prettier` sits between the presets and the shared
  rules.

## Testing

- **Test a behaviour once, at the cheapest tier that can see it**; a higher tier covers only what the lower one cannot
  see.
- **No test for wiring without logic, or for what the compiler enforces**; a caller tests its own branches, not its
  callee's rules.
- **One top-level group per file, named for the module; each case a present-tense behaviour sentence; one behaviour per
  case**, cases that differ only in data table-driven.
- **Arrange, act, assert**, marked once a phase has more than one line.
- **Fakes are small and hand-written; shared ones live in the test utilities.**
- **Each test owns its data**: cleared before each test, seeded with fixed timestamps; end to end on its own database
  and ports, through the real API, with unique names.
- **Integration tests run on the production engine.**
- **UI tests query by role and accessible name.**
- **`test` runs the fast tier only**; run the slower tier that covers a change before merging it.

## Vitest

### Writing a test

- **One top-level `describe` per file, named for the module under test** (`describe('entity.controller')`,
  `describe('cn')`); nested `describe`s group functions or behaviours, and hooks sit inside the top-level one.
- **`it` takes the behaviour sentence**: `it('forwards a 400 for an unknown param without reaching the DAO')`.
- **`// Arrange`, `// Act`, `// Assert` comments** once a phase has more than one line.
- **Import from `vitest`** (`describe`, `it`, `expect`, `vi`); no globals.
- **`vi.fn()` only where a call or its arguments matter**; cases that differ only in data are one `it.each`.
