# Coding Conventions

How this project is built and how to change it: an A2A agents workspace project, following the
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

Two A2A 1.0 agents, served by one server, each on either of two agent SDKs, and an interactive A2A command line, in a pnpm workspace: a weather agent, and a trip planner that asks the weather agent over A2A; the SDKs are the Claude Agent SDK and the Codex SDK, as runners of one interface. What the docs below do not say about it, and every place it departs from them, with the reason.

### Workspace

| Path                                        | Is                                                                                                                                                                                                                                                                                                                                               | Follows                                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `tooling/tsconfig`, `tooling/eslint-config` | the shared compiler options and ESLint rules                                                                                                                                                                                                                                                                                                     | Node package, Growing into a workspace                                                                        |
| `apps/server`                               | the agents; entry point `src/server.ts`                                                                                                                                                                                                                                                                                                          | Node package, plus Express, Pino, Express + Pino, REST API and Data access, through the building blocks below |
| `apps/client`                               | the A2A terminal client, for this agent or any other; entry point `src/main.ts`, with one module per concern: `args` (flags and usage), `card` (the card summary), `render` and `parts` (events and parts as lines, compact or `--verbose`), `conversation` (the ids between messages), `commands` (`/new`, `/help`, `/exit`), `style` (colours) | Node package                                                                                                  |

The apps never import each other: they meet only over A2A. Each keeps its own copy of the little both need (reading `PORT`, making and reading A2A text parts), since a shared package for a few lines would cost more than the copies.

### Server building blocks

`apps/server/src/` has two parts: the Express app, which serves, and `agents/`, which holds what it serves.

**The Express app.** Four files sit at the root of `src/`, as the Express doc places them: `server.ts` (the composition root), `app.ts` (the pure `createApp(context)` factory), `logger.ts` (the one Pino logger, shared with the agents) and `express.d.ts` (`AppContext` on `Express.Locals`). Everything else of the app is in the Express doc's blocks:

| Block      | Lives in                                       | Is                                                                                                                         | Must not                                                   |
| ---------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| controller | `controllers/<resource>.controller.ts`         | one `async (req, res, next)` per route of the server's own: `getHealth`                                                    | reach a dependency except through `req.app.locals.context` |
| middleware | `middlewares/<name>.middleware.ts`             | `notFoundHandler` and `errorHandler`, which apply to every request                                                         | answer a route of their own                                |
| context    | `models/app-context.model.ts` + `express.d.ts` | `AppContext`: the agents the app mounts, each as its A2A request handler, its tools handler and the paths of its endpoints | —                                                          |
| model      | `models/<name>.model.ts`                       | the app's types and errors: `app-context`, `config` (`ConfigError`)                                                        | contain logic beyond an error's message                    |
| helper     | `helpers/<name>.helper.ts`                     | the app's transport-free functions: configuration (`readPort`)                                                             | take an Express `Request`                                  |

**The agents.** `agents/core/` holds what every agent shares; `agents/<name>/` holds one agent and the domain only it needs. Each has one entry point at its root, its public face; everything else is in blocks, named and placed as above (`agents/<part>/<block>/<name>.<block>.ts`), and stays inside:

- **core's entry point is `agents/core/a2a-agent.ts`**: `createA2aAgent(definition, baseUrl)` builds an agent ready to serve from its id, its card base, its spec, its runner and its answer artifact. It serves the agent under `/agents/<id>/`: it adds to the card the JSON-RPC endpoint there, serves the spec's tools over MCP, and gives the agent a `TurnAgentExecutor` that runs the spec on the runner, with sessions of its own, a request handler with a task store of its own, the paths to mount them at, and the URL a client is given. The entry point also re-exports what an agent needs from core: the `AgentCardBase`, `A2aAgent`, `AgentSpec`, `AgentTool`, `ToolContext`, and `Runner` types, `ToolError` and `defineTool`, the two runners (`claudeRunner`, `codexRunner`), and `askAgentTool` with `ConnectAgent`. That list is core's public API.
- **an agent's entry point is `agents/<name>/<name>.agent.ts`**, in the table below. Core's has no block suffix, since core is not an agent.

The blocks the agents use:

| Block    | Lives in                                    | Is                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Must not                                                                             |
| -------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| agent    | `agents/<name>/<name>.agent.ts`             | an agent's entry point: `weatherAgent(options)` and `tripPlannerAgent(options)` return the agent ready to serve (`A2aAgent`: its card, its request handler, its tools handler, its paths, its URL). It names its runner (`claudeRunner()`, `codexRunner()`), builds its card base and its spec (instructions, tools, `maxSteps`), then calls core's `createA2aAgent`                                                                                                                                                                                                                                                                                                                              | read configuration itself: `server.ts` hands it its options                          |
| executor | `agents/core/executors/<name>.executor.ts`  | an A2A SDK `AgentExecutor`: `turn-agent`, one agent turn per message, streamed, with `input-required` and cancellation, on the `Runner` it is handed; knows no agent and no SDK                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | reach an SDK except through the `Runner` interface                                   |
| runner   | `agents/core/runners/<engine>.runner.ts`    | a strategy of the `Runner` interface: runs one turn of any `AgentSpec` on one agent SDK and reports it as turn events. Every runner gives the model the spec's tools and nothing else, loads none of the machine's settings, ends the turn with a structured `{ outcome, text }` read with zod, words tool calls the same, resumes the session it is given, holds the turn to `maxSteps`, and stops when aborted: `claude` (one Claude Agent SDK `query()`, the tools in-process) and `codex` (one Codex SDK thread run, the tools over the agent's MCP endpoint)). Each takes its SDK's entry (`query`, `Codex`) as an option, for tests. The runner contract tests hold both to the same events | know about A2A or Express, or coordinate anything the model's own tool loop does not |
| store    | `agents/core/stores/<name>.store.ts`        | state kept in memory, created for each agent by `createA2aAgent` and handed to what uses it: `session` (the SDK session of each A2A context)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | be reached any other way than through what `createA2aAgent` hands in                 |
| client   | `agents/<name>/clients/<service>.client.ts` | one outside service, reached with what it needs handed in: `open-meteo` (validates every answer with zod, throws `OpenMeteoError`, a `ToolError`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | know about A2A or Express                                                            |
| tool     | `agents/<part>/tools/<name>.tool.ts`        | `AgentTool`s, defined once for every runner with `defineTool`: a name, a description, a zod input and `run`, which answers in text and throws a `ToolError` for a failure the model should hear about. `weather` (`find_city`, `get_forecast`) in the weather agent; `ask-agent` (`askAgentTool`: asks another A2A agent, keeping one conversation with it per A2A context) in core                                                                                                                                                                                                                                                                                                               | call a service except through a client, or know which runner runs it                 |
| prompt   | `agents/<name>/prompts/<name>.prompt.ts`    | an agent's instructions, whichever runner reads them: `weather` and `trip-planner` (the instructions, dated per turn)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | call a model                                                                         |
| model    | `agents/<part>/models/<name>.model.ts`      | types and errors: `turn` (turn events, `TurnRequest`), `runner` (`Runner`, `AgentSpec`, `TurnAgent`, `AgentTool`, `ToolContext`, `ToolError`) and `a2a-agent` (`AgentCardBase`, `AgentDefinition`, `A2aAgent`) in core; `weather` (places, forecasts, `WeatherService`, `OpenMeteoError`) in the weather agent                                                                                                                                                                                                                                                                                                                                                                                    | contain logic beyond an error's message                                              |
| helper   | `agents/<part>/helpers/<name>.helper.ts`    | transport-free functions: A2A messages and text parts, the answer format (`answer`: its schema, reading it, wording a tool call), and running a tool (`tool`: `runTool`, `defineTool`) in core; weather codes and formatting in the weather agent                                                                                                                                                                                                                                                                                                                                                                                                                                                 | take an Express `Request`                                                            |
| handler  | `agents/core/handlers/<name>.handler.ts`    | a request handler on Node's own `IncomingMessage` and `ServerResponse`, which `app.ts` mounts: `tools-mcp` (an agent's tools over MCP, stateless, at `/agents/<id>/mcp/<contextId>`, for the Codex runner)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | take an Express `Request`, or answer anything but what its SDK speaks                |

The boundaries, enforced by `no-restricted-imports` in `apps/server/eslint.config.js`:

- **Nothing in `agents/` imports Express or the app**: no Express packages, and none of the app's files or blocks. `server.ts` hands an agent what it needs. The logger is shared.
- **`core/` imports no agent**, since it serves every agent.
- **An agent imports itself and core's entry point, `core/a2a-agent.ts`**: never core's blocks, never another agent.
- **The app reaches an agent only through its entry point**, `agents/<name>/<name>.agent.ts`: `server.ts` calls `weatherAgent(options)` and `tripPlannerAgent(options)` and hands what they return to `createApp`.
- **An agent that uses another reaches it over A2A**, at the URL `server.ts` hands it, as any A2A client would: the trip planner is given `weatherAgent(…).url`, never the weather agent's code. `core/` and an agent's blocks are used only inside `agents/`.

Tests mirror the source: `tests/unit/<block>/` for the app's blocks and `tests/unit/agents/<part>/<block>/` for the agents' (`pnpm test`), and `tests/api/` for the endpoints over HTTP (`pnpm test:integration`). `tests/fixtures/` holds recorded samples and `tests/utils/` the fakes, the HTTP mocks and the test app.

### Adding an agent

1. **Create `agents/<name>/`** with its entry point, `<name>.agent.ts`: a function that takes what the agent needs from the server (its base URL) and returns the agent ready to serve, built with core's `createA2aAgent` from its card base (what the agent is; `createA2aAgent` adds where it is served), its spec (instructions, tools, `maxSteps`), its runner, named in code (`runner = claudeRunner()` in its options, so a test can hand in one on a fake SDK), and its answer artifact. Write its tools with `defineTool`, never in an SDK's terms, so any runner runs it. Import from core only what `core/a2a-agent.ts` exports; if an agent needs more of core, export it there. Its prompt, tools and any client, models and helpers go in their blocks.
2. **Keep what is shared in `core/`.** When the new agent needs something another agent has, and it is not about either agent's domain, move it to `core/` rather than importing across agents.
3. **Serve it from `server.ts`**: call its entry point with its options and add the result to the agents handed to `createApp`. Its `id` gives it endpoints of its own, `/agents/<id>/.well-known/agent-card.json` and `/agents/<id>/a2a/jsonrpc`, since an A2A agent is identified by its card and its URL; `app.ts` mounts each agent's.
4. **To have it use another agent, hand it that agent's `url`** from `server.ts` and give it a tool made with core's `askAgentTool`, as the trip planner asks the weather agent.

### Adding a runner

1. **Write `agents/core/runners/<engine>.runner.ts`**: a factory, `<engine>Runner(options)`, that returns a `Runner`, taking its SDK's entry point as an option so tests can fake it. It adapts what the SDK offers to the contract in the runner row above, with the shared helpers: `runTool` to run a tool, `answerJsonSchema` and `readAnswer` for the answer, `toolCallProgress` for a tool call. An SDK that cannot run tools in this process reaches them at `agent.toolsUrl(contextId)`, over MCP.
2. **Hold it to the contract**: its test plays the contract's turns on a fake of its SDK with `describeRunnerContract`, as `claude.runner.test.ts` and `codex.runner.test.ts` do, and adds what only that SDK has.
3. **Export its factory from `core/a2a-agent.ts`**, so an agent's entry point can name it, and add it to the README's runner tables.

### Adding a concept

Code that does not fit a block above is a new concept, and the structure grows to hold it rather than bending around it:

1. **Check the tables first.** An HTTP route is a controller, a type is a model, a call to another service is a client, a pure function is a helper, an agent SDK is a runner.
2. **Give a new concept a block**: a plural folder named for it, files named `<name>.<block>.ts` (`notifiers/slack.notifier.ts`), tests mirrored under `tests/unit/`. An app concept goes under `src/`, an agent concept under `agents/core/` or `agents/<name>/`. Never a file at the root of `src/`, which holds the four files above only.
3. **Add its row to the right table in the same commit**: where it lives, what it is, and what it must not do, which says what it may depend on.
4. **Reach it the way its neighbours are reached**: what handlers use goes on `AppContext`; what an agent's executor, runner or tools use is handed in by its entry point, which gets what it needs from `server.ts` as options.
5. **When both apps need the same small piece, copy it** into each, in the block or module where it is used. A shared package (`packages/<name>`, imported by both apps and importing neither) is worth creating only once what they share is substantial and must not drift, such as a protocol both speak beyond what the A2A SDK gives.

### Commands

From the root: `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm format:check` are the required checks; `pnpm test:integration` runs the server's API tests. `pnpm dev` and `pnpm start` run the agents, `pnpm cli` the command line.

### Lint additions

Rules `tooling/eslint-config` adds to the shared ones below, for every package:

- **No `await` as a call argument** (`no-restricted-syntax`, an error): `publishEnd(taskRef, await runOneTurn(…), bus)` hides a step that can take long and fail, so the awaited value gets a name first: `const end = await runOneTurn(…)`, then `publishEnd(taskRef, end, bus)`.
- **No call that takes arguments as a `for … of` iterable** (`no-restricted-syntax`, an error): `for await (const event of runner.runTurn(agent, { prompt, sessionId: sessions.get(id), abortController }))` hides the lookup and the work the loop starts in its head, so each step gets a name first: `const sessionId = sessions.get(id)`, `const turn = runner.runTurn(agent, { prompt, sessionId, abortController })`, then `for await (const event of turn)`. A call with no arguments (`map.values()`) only views what is already named, so it is fine.

Tests are exempt from both, since `expect(await response.json())` is the test runner's own idiom. Both are entries of `restrictedSyntax` in `tooling/eslint-config`. A package that sets its own `no-restricted-syntax` replaces them, so it spreads `restrictedSyntax` into its list.

### Functions

- **Extract a function only when it is used more than once.** A step used once stays where it runs, and a `const` with a meaningful name carries what a function name would (`const tool = block.name.replace(/^mcp__[^_]+__/, '')`); a `switch` case that needs statements gets braces. Exported functions are a module's API and are exempt.
- **A size guardrail is a prompt to look, not an order to split.** When one fires, read the function. If it is hard to follow, split it by meaning, into pieces whose names say more than their bodies or that are used more than once (`renderAnswer` serves both artifacts and messages). If it reads well as one piece, keep it whole and silence the rule on that line with its reason (`// eslint-disable-next-line complexity -- one case per A2A state`). Never extract a one-off helper only to bring a count down: a reader then jumps between pieces that only make sense together.
- **A private function used once is a unit with a name worth reading**: `#runOneTurn` (one turn, apart from publishing the task), the Claude runner's `toolServer` (the agent's tools as an in-process MCP server), the ask-agent tool's `question` (the A2A message), and the client's `ask`, `compactStatus` and `renderStatus`.

### Exceptions

- **The server runs TypeScript as it is**: no `build`, no `dist/`, `typecheck` is `tsc -b` with `noEmit`. The Express doc's "compiled, not run as it is" does not apply, because the workspace packages export their sources and Node 24 strips the types.
- **The A2A and MCP endpoints are their SDKs' own handlers**, mounted in `app.ts` with `app.use` at each agent's `/agents/<id>/.well-known/agent-card.json` and `/agents/<id>/a2a/jsonrpc`, and the tools at `/agents/<id>/mcp/:contextId`, with no controller in front: the SDK answers them, and their requests, answers and errors follow the A2A 1.0 spec (JSON-RPC errors), not the REST API rules. Those govern the server's own routes (`GET /health`) and the not-found answer.
- **No `express.json()`**: the server's own routes take no body, and the A2A JSON-RPC handler parses its own, answering malformed JSON as a JSON-RPC parse error.
- **No DAO yet**: the only state is the `session` store, in memory. When it moves to a database it becomes `agents/core/daos/session.dao.ts`, following Data access.
- **`GET /health` probes nothing**: the models and Open-Meteo are reached per turn, and a failing one fails that turn, not the server.
- **The size guardrails are looser than the stack docs', and statements are not counted**: complexity 15 rather than 10, functions up to 80 lines without blanks and comments, and no `max-statements`. At the stricter limits, flat `switch`es over A2A states and SDK events, and `?.` and `??` chains, fired them while being the easiest form to read, and the splits they forced made the code harder to follow. Function length is `max-lines-per-function`'s job.
- **The client is a command line, not an Express app**, so it keeps the Node package layout (`src/main.ts` and its modules).
- **The root `format` and `format:check` also cover the root's own files** (`*.json`, `*.md`, `*.yaml`), which `pnpm -r` never reaches.
- **`pnpm test` and `pnpm test:integration` never call a model or Open-Meteo**: each runner's SDK entry and `fetch` are handed in, so tests use recorded samples and fakes. The API tests run the trip planner on a fake Codex that calls the agent's MCP tools endpoint as the Codex CLI does, so its tools really run and its calls to the weather agent go over real HTTP.
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
- **When a size guardrail fires, look before you split**; split by meaning, never into one-off helpers that exist only for the count.
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
- **Size guardrails warn** (complexity 15, depth 4, 80 lines per function not counting blanks and comments, 4
  parameters, 400 lines per file, 3 nested callbacks): they flag code to look at, as Functions says.
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
