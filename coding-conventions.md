# Coding Conventions

How this project is built and how to change it: an A2A weather agent workspace project, following the
`consult-stack-knowledge` docs it was built from. It is the working guide for everyone who changes the code, people and agents
alike. The code follows every rule here; a change that breaks one changes this file in the same commit.

## Contents

- [This project](#this-project)
- [Node package](#node-package)
- [Code style](#code-style)
- [pnpm](#pnpm)
- [TypeScript](#typescript)
- [REST API](#rest-api)
- [Data access](#data-access)
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

A weather agent on the Claude Agent SDK, served over A2A 1.0, and an interactive A2A command line, in a pnpm workspace. What the docs below do not say about it, and every place it departs from them, with the reason.

### Workspace

| Path                                        | Is                                                                                                                                                                                                                                                                                                                                               | Follows                                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `tooling/tsconfig`, `tooling/eslint-config` | the shared compiler options and ESLint rules                                                                                                                                                                                                                                                                                                     | Node package, Growing into a workspace                                                                        |
| `apps/server`                               | the agent; entry point `src/server.ts`                                                                                                                                                                                                                                                                                                           | Node package, plus Express, Pino, Express + Pino, REST API and Data access, through the building blocks below |
| `apps/client`                               | the A2A terminal client, for this agent or any other; entry point `src/main.ts`, with one module per concern: `args` (flags and usage), `card` (the card summary), `render` and `parts` (events and parts as lines, compact or `--verbose`), `conversation` (the ids between messages), `commands` (`/new`, `/help`, `/exit`), `style` (colours) | Node package                                                                                                  |

The apps never import each other: they meet only over A2A. Each keeps its own copy of the little both need (reading `PORT`, making and reading A2A text parts), since a shared package for a few lines would cost more than the copies.

### Server building blocks

`apps/server/src/` holds four files at its root, as the Express doc places them: `server.ts` (the composition root), `app.ts` (the pure `createApp(context)` factory), `logger.ts` (the one Pino logger) and `express.d.ts` (`AppContext` on `Express.Locals`). Everything else is in a block. The first five are the Express doc's; the rest are this project's, for what an agent server has that a REST API does not.

| Block      | Lives in                                       | Is                                                                                                                                                                                                     | Must not                                                                 |
| ---------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| controller | `controllers/<resource>.controller.ts`         | one `async (req, res, next)` per route of the server's own: `getHealth`                                                                                                                                | reach a dependency except through `req.app.locals.context`               |
| middleware | `middlewares/<name>.middleware.ts`             | `notFoundHandler` and `errorHandler`, which apply to every request                                                                                                                                     | answer a route of their own                                              |
| context    | `models/app-context.model.ts` + `express.d.ts` | `AppContext`: the A2A request handler the app mounts                                                                                                                                                   | —                                                                        |
| model      | `models/<name>.model.ts`                       | types and error classes: `weather` (places, forecasts, `WeatherService`, `OpenMeteoError`), `turn` (turn events, `RunTurn`), `config` (`ConfigError`), `app-context`                                   | contain logic beyond an error's message                                  |
| helper     | `helpers/<name>.helper.ts`                     | transport-free functions: configuration (`requireVariable`, `readPort`), the Agent Card, A2A messages and text parts, weather codes and formatting                                                     | take an Express `Request`                                                |
| client     | `clients/<service>.client.ts`                  | one outbound integration each, reached with what it needs handed in: `open-meteo` (validates every answer with zod, throws `OpenMeteoError`), `claude` (one Claude Agent SDK `query()` as turn events) | know about A2A or Express                                                |
| tool       | `tools/<name>.tool.ts`                         | the Claude tools and the in-process MCP server that offers them: `weather` (`find_city`, `get_forecast`)                                                                                               | call an API except through a client                                      |
| prompt     | `prompts/<name>.prompt.ts`                     | a system prompt and the protocol of its answers: `weather` (the instructions, the `COMPLETED` / `AWAITING_USER_INPUT` marker)                                                                          | call a model                                                             |
| executor   | `executors/<name>.executor.ts`                 | an A2A SDK `AgentExecutor`: `weather-agent`, one Claude turn per message, streamed, with `input-required` and cancellation                                                                             | reach a client except through the `RunTurn` it is handed                 |
| store      | `stores/<name>.store.ts`                       | state kept in memory, created by the composition root and handed to what uses it: `session` (the Claude session of each A2A context)                                                                   | be reached any other way than through what the composition root hands in |

Tests mirror the blocks: `tests/unit/<block>/<name>.<block>.test.ts` (`pnpm test`), and `tests/api/` for the endpoints over HTTP (`pnpm test:integration`). `tests/fixtures/` holds recorded samples and `tests/utils/` the fakes, the HTTP mocks and the test app.

### Adding a concept

Code that does not fit a block above is a new concept, and the structure grows to hold it rather than bending around it:

1. **Check the table first.** An HTTP route is a controller, a type is a model, a call to another service is a client, a pure function is a helper.
2. **Give a new concept a block**: a plural folder under `src/` named for it, files named `<name>.<block>.ts` (`notifiers/slack.notifier.ts`), tests in `tests/unit/<block>/`. Never a file at the root of `src/`, which holds the four files above only.
3. **Add its row to the table above in the same commit**: where it lives, what it is, and what it must not do, which says what it may depend on.
4. **Reach it the way its neighbours are reached**: what handlers use goes on `AppContext`; what the executor or the tools use is handed in by `server.ts`.
5. **When both apps need the same small piece, copy it** into each, in the block or module where it is used. A shared package (`packages/<name>`, imported by both apps and importing neither) is worth creating only once what they share is substantial and must not drift, such as a protocol both speak beyond what the A2A SDK gives.

### Commands

From the root: `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm format:check` are the required checks; `pnpm test:integration` runs the server's API tests. `pnpm dev` and `pnpm start` run the agent, `pnpm cli` the command line.

### Exceptions

- **The server runs TypeScript as it is**: no `build`, no `dist/`, `typecheck` is `tsc -b` with `noEmit`. The Express doc's "compiled, not run as it is" does not apply, because the workspace packages export their sources and Node 24 strips the types.
- **The A2A endpoints are the SDK's own handlers**, mounted in `app.ts` with `app.use` at `/.well-known/agent-card.json` and `/a2a/jsonrpc`, with no controller in front: the SDK answers them, and their requests, answers and errors follow the A2A 1.0 spec (JSON-RPC errors), not the REST API rules. Those govern the server's own routes (`GET /health`) and the not-found answer.
- **No `express.json()`**: the server's own routes take no body, and the A2A JSON-RPC handler parses its own, answering malformed JSON as a JSON-RPC parse error.
- **No DAO yet**: the only state is the `session` store, in memory. When it moves to a database it becomes `daos/session.dao.ts`, following Data access.
- **`GET /health` probes nothing**: Claude and Open-Meteo are reached per turn, and a failing one fails that turn, not the server.
- **The client is a command line, not an Express app**, so it keeps the Node package layout (`src/main.ts` and its modules).
- **The root `format` and `format:check` also cover the root's own files** (`*.json`, `*.md`, `*.yaml`), which `pnpm -r` never reaches.
- **`pnpm test` and `pnpm test:integration` never call Claude or Open-Meteo**: the turn runner, the query and `fetch` are handed in, so tests use recorded samples and fakes.
- **No unit tests for `server.ts`, `app.ts` or the client's `main.ts`**: they only wire. The API tests cover what `app.ts` mounts; running the agent and the command line end to end covers the rest.

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

## Data access

- **Only the data layer touches the database**: DAOs, and read-only queries where the project has them. Routes,
  controllers, stores and pages never build a query or import a table.
- **One DAO per table**, created by the server entry and reached through the app's context; nothing else opens a
  connection.
- **Types are inferred from the schemas**, never written to mirror them.
- **The data layer throws domain errors** (`NotFoundError`) and never an HTTP error; the HTTP layer maps them.
- **Every DAO implements the one contract**: `get`, `list`, `create`, `update`, `delete`, each taking one input object;
  every filtered read goes through `list` with the typed filter, never a custom finder such as `findBySlug`.
- **A read across tables is a read-only query** offering the same `get` and `list`.
- **Every list has a default sort, an `id` tie-breaker and a maximum page size.**
- **A write across tables is a service method in one atomic unit** (a transaction, or the engine's batch where it has no
  transactions); a batch over many rows is one statement.
- **DAOs, queries and services are tested against the real database**, seeded through the data layer or a seed helper.

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
