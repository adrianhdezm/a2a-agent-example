# Coding Conventions

How this project is built and how to change it: an A2A agent server monorepo project, following the
`consult-stack-knowledge` docs it was built from. It is the working guide for everyone who changes the code, people and agents
alike. The code follows every rule here; a change that breaks one changes this file in the same commit.

## Contents

- [This project](#this-project)
- [Node package](#node-package)
- [Code style](#code-style)
- [pnpm](#pnpm)
- [TypeScript](#typescript)
- [REST API](#rest-api)
- [Testing](#testing)
- [Node](#node)
- [Node + TypeScript](#node--typescript)
- [Express](#express)
- [Pino](#pino)
- [Express + Pino](#express--pino)
- [ESLint](#eslint)
- [TypeScript + ESLint](#typescript--eslint)
- [Prettier](#prettier)
- [ESLint + Prettier](#eslint--prettier)
- [Vitest](#vitest)

## This project

What the docs below do not say about this workspace, and every place it departs from them, with the reason.

### Workspace

| Path                                              | Is                                                                                                                                                                          | Follows                                                                          |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `tooling/tsconfig`, `tooling/eslint-config`       | the shared compiler options and ESLint rules                                                                                                                                | Node package, Growing into a workspace                                           |
| `packages/harness`                                | the port: `Harness`, `Session`, the normalized events and `HarnessRegistry`; knows nothing of A2A                                                                           | Node package                                                                     |
| `packages/claude-driver`, `packages/codex-driver` | drivers: each implements `harness` on one SDK, as a database driver implements a database API; depend on `harness` only                                                     | Node package                                                                     |
| `packages/a2a-bridge`                             | the bridge from the A2A protocol to a harness: `HarnessExecutor`, an A2A SDK `AgentExecutor` that runs one harness turn per message; depends on `harness` and `@a2a-js/sdk` | Node package                                                                     |
| `apps/client`                                     | the smoke-test CLI; entry point `src/main.ts`                                                                                                                               | Node package                                                                     |
| `apps/server`                                     | the A2A server; entry point `src/server.ts`                                                                                                                                 | Node package, plus Express, Pino, Express + Pino and REST API for its own routes |

Packages are named for their role, so the dependency rule reads from the names: a `*-driver` sits under `harness` and talks to one SDK; a `*-bridge` sits over it and lets one protocol call it; neither knows the other.

### Server layout

`apps/server/src/` keeps at its root only what the Express doc puts there: `server.ts`, `app.ts`, `logger.ts` and `express.d.ts`. Everything else is one of these blocks, its file named with the block's singular suffix:

| Block      | Lives in                               | Is                                                                                                                                                                                                                                                                                                                            | Must not                                                   |
| ---------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| model      | `models/<name>.model.ts`               | the zod schemas of what the API takes, the types inferred from them, and error classes: `agent`, `list`, `config`, `app-context`                                                                                                                                                                                              | contain logic beyond an error's message                    |
| store      | `stores/<name>.store.ts`               | `agent.store`: the agents' records in memory, the data layer a DAO replaces once agents outlive a restart; throws `AgentError`                                                                                                                                                                                                | hold live objects, or reach the runtime                    |
| runtime    | `runtimes/<name>.runtime.ts`           | `agent.runtime`: where the agents run, each one's SDK request handler, task store and sessions, with a `HarnessExecutor` from `a2a-bridge` built from the agent's session config; rebuilt from the records, never stored                                                                                                      | reach the store                                            |
| service    | `services/<name>.service.ts`           | `agent.service`: create, change and delete an agent in the store and the runtime at once, check its harness, place its workspace                                                                                                                                                                                              | take an Express `Request`                                  |
| helper     | `helpers/<name>.helper.ts`             | functions with no Express in them: config, URLs and agent responses, cards, A2A messages                                                                                                                                                                                                                                      | take an Express `Request`                                  |
| controller | `controllers/<resource>.controller.ts` | one `async (req, res, next)` per route. `agent.controller` validates with the model's schemas, calls the service and maps `AgentError` to a status (`unknown-id` 404, `duplicate-id` 409, `unknown-harness` 400); `a2a.controller` looks the agent up in the runtime and hands the request to its SDK handler, or answers 404 | reach a dependency except through `req.app.locals.context` |
| middleware | `middlewares/<name>.middleware.ts`     | `notFoundHandler` and `errorHandler`, which apply to every request                                                                                                                                                                                                                                                            | answer a route of their own, or call the service           |

The server starts with no agents and defines none: every agent is created by a client, the starter ones by `pnpm agents seed` from the client's `src/starter-agents.ts`. Agents are a REST resource: `POST`, `GET`, `PATCH` and `DELETE /agents[/:id]` change them at runtime, and their A2A endpoints follow, because the routes in `app.ts` are fixed and look each agent up when a request arrives. The server picks every workspace (`workspaces/<id>`); a client never does. The harness and the id cannot change after creation, and deleting an agent leaves its workspace on disk.

The store and the runtime are apart because only records can be persisted: SDK handlers, task stores and sessions are live objects. The store is not yet a DAO, since the Data access concept's DAOs are tables in a real database. When agents come from a database, `daos/agent.dao.ts` takes `agent.store`'s place behind the same `create`, `get`, `list`, `update` and `delete`, and the service opens each stored agent in the runtime at start; until then agents created at runtime are lost when the server restarts.

### Commands

From the root: `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm format:check` are the required checks; `pnpm test:integration` runs the server's API tests; `pnpm dev:server` and `pnpm start:server` run the server; `pnpm agents seed` creates the starter agents (`claude-coder`, `codex-coder`), and `pnpm agents list`, `pnpm agents create <agent-id> --harness <name> --instructions "<goal>"` and `pnpm ask <agent-id> "<prompt>"` drive it.

### Exceptions

- **The server's entry point is `src/server.ts`**, the Express doc's composition root; the Node package Layout's `src/main.ts` is the client's. Either way it is the one file with side effects.
- **The server runs TypeScript as it is**: no `build`, no `dist/`, `typecheck` is `tsc -b` with `noEmit`. The Express doc's "compiled, not run as it is" does not apply, because the workspace packages export their sources and Node 24 strips the types.
- **The A2A endpoints are the SDK's routers**, reached through `/agents/:id/.well-known/agent-card.json` and `/agents/:id/a2a/jsonrpc`. Their requests, answers and errors follow the A2A 1.0 spec (JSON-RPC errors), not the REST API rules, which govern the server's own routes (`/agents`, `/agents/:id`, `GET /health`) and the not-found answer, including an unknown agent's.
- **No app-wide `express.json()`**: it is mounted on `POST` and `PATCH /agents` only, because the JSON-RPC router parses its own body and must answer malformed JSON as a JSON-RPC parse error.
- **Agent ids are slugs the client chooses**, not UUIDs: the id names every endpoint of the agent (`/agents/claude-coder/a2a/jsonrpc`), so it has to be readable and stable; a taken id is a 409.
- **`GET /agents` takes no `filter` yet**: it answers the REST API list envelope with `page`, `pageSize`, `sortField` (`id`, `name`, `createdAt`) and `sortDirection`. The JSON `filter` param arrives with the store.
- **`GET /health` probes nothing yet**: the server has no dependency; a persistent store adds its key.
- **Server tests are split by tier**: `tests/unit/` mirrors `src/` and runs in `pnpm test`; `tests/api/` drives the endpoints over HTTP on an ephemeral port and runs in `pnpm test:integration`. It needs no database, keys or network. The other packages keep `tests/<module>.test.ts`.
- **The shared harness fake is a subpath export**, `@a2a-agent-example/harness/testing`, since fakes used by several packages cannot live in one package's test utilities.

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

## REST API

- **Resources are plural nouns and methods carry the verb**: `GET` list and read, `POST` create (201), `PATCH` partial
  update, `DELETE` (204, no body).
- **Every error answers `{ status: 'error', message }`** from one error handler; a client error's message is shown, an
  unexpected one's hidden and logged.
- **Every input is validated at the edge against a strict schema**; anything unknown is a 400.
- **Handlers validate, call the data layer and shape the answer**; a missing resource is a 404.
- **Every list speaks one format**: `?filter=<json>&sortField=…&sortDirection=ASC|DESC&page=…&pageSize=…` in,
  `{ items, total, page, pageSize, totalPages }` out.
- **Dates travel as ISO-8601 strings, ids are UUIDs, absence is `null`.**
- **A change to the API's types changes its clients' types in the same commit.**
- **A new route gets a handler test and a case in its resource's API test.**

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

## Node

- **Node 24 or newer.** ([Node.js release schedule](https://github.com/nodejs/release#release-schedule))
- **The environment comes from the root `.env`** (git-ignored; `.env.example` is committed and lists every variable).
  A missing `.env` or a missing required variable fails at start; there are no fallback values for configuration.
- **The entry point is the only file with side effects**; everything else exports, and is tested through its exports.

## Node + TypeScript

- **Code Node runs as TypeScript imports with the `.ts` extension**, keeps type imports in their own `import type`
  statement, and avoids syntax Node cannot strip.
- **Code compiled by `tsc` for Node imports with the `.js` extension.**

## Express

### Architecture

```
request ─► request log ─► cors ─► express.json() ─► route ─► controller
errors:  next(err) ─► notFoundHandler ─► errorHandler ─► { status: 'error', message }
```

- **`server.ts` is the composition root**: it builds the context, starts the listener and shuts down cleanly.
- **`app.ts` is a pure factory**: the context goes on `app.locals.context` once, handlers mount directly on the app
  (no routers), and nothing in it reads the environment.

### Building blocks

| Block      | Lives in                                       | Is                                              | Must not                                                   |
| ---------- | ---------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------- |
| controller | `controllers/<resource>.controller.ts`         | one exported `async (req, res, next)` per route | reach a dependency except through `req.app.locals.context` |
| middleware | `middlewares/<name>.middleware.ts`             | `errorHandler` (terminal) and `notFoundHandler` | call a DAO                                                 |
| context    | `models/app-context.model.ts` + `express.d.ts` | `AppContext` and its typing on `Express.Locals` | —                                                          |
| helper     | `helpers/<name>.helper.ts`                     | transport-agnostic functions                    | take an Express `Request`                                  |
| model      | `models/<name>.model.ts`                       | types and error classes                         | contain logic                                              |

### Controllers and errors

- **Every handler has one shape**: `async (req, res, next): Promise<void>` with `try { … } catch (err) { next(err) }`.
- **Every input is validated inline with `safeParse`**; a failure throws `createError(400, …, { expose: true, cause })`.
  There are no shared validation helpers, so each handler shows every error it can produce.
- **Errors leave a handler only through `next(err)`**; `errorHandler` writes `{ status: 'error', message }`, the message
  only when the error is exposed.
- **Naming**: handlers are verb + resource (`listEntities`, `getEntity`), never `entityController`; middlewares end in
  `Handler`. Folders are plural, files keep the singular suffix (`controllers/entity.controller.ts`).

### Testing the API

- **Unit tests call handlers and middlewares as functions**, with a mock request (a stub context on
  `req.app.locals.context`), a spy response and a spy next from the test utilities. They assert the response or the
  error passed to `next`, and what the DAO received; every 400 also asserts the DAO was never called. No app, no
  server.
- **API tests serve the real app on an ephemeral port**, on the real DAO and a real database, and drive it over
  `fetch`: every route's happy path, the errors only the real stack produces, and what `app.ts` adds
  (malformed JSON → 400, over 100 kB → 413, an unmatched path → 404 in the standard shape).

## Pino

- **One logger in `src/logger.ts`**, writing JSON to stdout; nothing else creates one.
- **The level comes from `LOG_LEVEL`**: `debug` by default, `info` in production, `silent` in tests.
- **Errors are logged as `{ err }`** with a short message.
- **Pretty output is a pipe in the `dev` script only**, never an import or a transport.

## Express + Pino

- **Every request is logged by `pino-http`**, the first middleware, on the one logger.
- **Errors are logged once, by `errorHandler`, through `req.log`**: 5xx at `error`, 4xx at `warn`.

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

## Vitest

### Writing a test

- **One top-level `describe` per file, named for the module under test** (`describe('entity.controller')`,
  `describe('cn')`); nested `describe`s group functions or behaviours, and hooks sit inside the top-level one.
- **`it` takes the behaviour sentence**: `it('forwards a 400 for an unknown param without reaching the DAO')`.
- **`// Arrange`, `// Act`, `// Assert` comments** once a phase has more than one line.
- **Import from `vitest`** (`describe`, `it`, `expect`, `vi`); no globals.
- **`vi.fn()` only where a call or its arguments matter**; cases that differ only in data are one `it.each`.
