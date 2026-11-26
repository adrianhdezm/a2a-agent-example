# a2a-agent-example

Two agents served over [A2A 1.0](https://a2a-protocol.org/v1.0.0/specification/) with [`@a2a-js/sdk`](https://github.com/a2aproject/a2a-js), on two agent SDKs, and an interactive command line to talk to them:

- a **weather agent** on the [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview), with two tools over Open-Meteo;
- a **trip planner** on the [Codex SDK](https://github.com/openai/codex/tree/main/sdk/typescript), with no tools, that asks the weather agent for forecasts over A2A, as any A2A client would.

Both run behind the same `TurnAgentExecutor`: each SDK has a runner that reports a turn as the same turn events, so the A2A side does not know which one answers.

It follows the shape of the a2a-js [`movie-agent`](https://github.com/a2aproject/a2a-js/tree/main/src/samples/agents/movie-agent) and [`cli.ts`](https://github.com/a2aproject/a2a-js/blob/main/src/samples/cli.ts) samples, with the Claude Agent SDK in place of Genkit and [Open-Meteo](https://open-meteo.com) in place of TMDB. Open-Meteo needs no API key, Claude signs in the way Claude Code does and Codex the way the Codex CLI does, so the agents need no keys of their own.

What it shows of A2A:

- **An Agent Card per agent**, at `/agents/weather/.well-known/agent-card.json` and `/agents/trip-planner/.well-known/agent-card.json`, each with one JSON-RPC interface and one skill.
- **An agent calling an agent**: the trip planner is an A2A client of the weather agent, and streams its progress as its own.
- **Streaming**: the agent's tool calls arrive as `TASK_STATE_WORKING` updates while it works.
- **`input-required`**: when the question is ambiguous ("Springfield?"), the agent asks back, and the answer continues the same task. Through the trip planner, the weather agent's question reaches you, and your answer continues the weather agent's task.
- **Multi-turn conversations**: every message in a `contextId` resumes the same Claude session or Codex thread, so the agent remembers what was said.
- **Cancellation**: `cancelTask` aborts the running turn and ends the task `TASK_STATE_CANCELED`; cancelling the trip planner also cancels the weather agent's task it is waiting on.

## Run it

You need Node 24 or newer and pnpm 11 or newer (`corepack enable` gives you the version `package.json` names).

```bash
pnpm install
```

```bash
cp .env.example .env
```

The weather agent runs Claude through the Claude Agent SDK, which signs in the way Claude Code does on this machine: if Claude Code works here, so does the agent. If it has no credentials here, put an API key in `.env` as `ANTHROPIC_API_KEY`.

The trip planner runs Codex through the Codex SDK, which drives the Codex CLI installed with it and signs in the way the CLI does: with `codex login` (`pnpm --filter server exec codex login`), or with an OpenAI API key in `.env` as `CODEX_API_KEY`. Then start both agents:

```bash
pnpm dev
```

In a second terminal, start the command line:

```bash
pnpm cli
```

`pnpm cli` is a general A2A terminal client: it connects to the trip planner on the `PORT` in `.env`, or to any A2A agent whose URL you pass. To talk to the weather agent directly:

```bash
pnpm cli http://localhost:41241/agents/weather/
```

`pnpm cli --help` lists its flags:

| Flag                 | Does                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------- |
| `--verbose`          | Heads every event with its time, state, task and context, and says when a task is final |
| `--card-path <path>` | Reads the Agent Card from another path than `.well-known/agent-card.json`               |

In the session, `/help` lists the commands, `/new` starts a new conversation, `/exit` quits, and Ctrl+C cancels the answer in progress. Answers show every kind of A2A part: text as it is, links and raw bytes described, data as JSON.

A session with the trip planner looks like this, trimmed (the reasoning Codex reports along the way varies from run to run):

```text
Trip Planner v0.1.0
Helps you get ready for a trip: what to pack and wear, from the forecast the Weather Agent gives it.
  Endpoint:  JSON-RPC at http://localhost:41241/agents/trip-planner/a2a/jsonrpc (A2A 1.0)
  Streaming: yes
  Skills:
    Trip planning: A packing list and practical advice for a trip in the next 7 days, from the forecast where you are going.
      e.g. What should I pack for Lisbon this weekend?

Type a question, or /help for the commands.

Trip Planner > You: I'm in Springfield on Monday, what do I wear?
  … Looking into it…
  … Asking the Weather Agent: What is the weather in Springfield on Monday?
  … Weather Agent: Looking into it…
  … Weather Agent: Calling find_city {"name":"Springfield"}
Agent: There are several Springfields. Which one are you going to: Illinois, Missouri or Massachusetts?
  (answer to continue, or /new to start over)
Trip Planner > You: Illinois
  … Looking into it…
  … Asking the Weather Agent: Springfield, Illinois
  … Weather Agent: Looking into it…
  … Weather Agent: Calling get_forecast {"latitude":39.80172,"longitude":-89.64371,"days":7}
Agent: Monday in Springfield, Illinois looks cold and snowy: -4 to 3 °C, with a high chance of snow.
- A warm coat, a hat and gloves
- Waterproof boots
- Layers for indoors
  ✓ done
```

And one with the weather agent on its own:

```text
Weather Agent v0.1.0
Answers questions about the weather now and for the next 7 days anywhere in the world, from Open-Meteo forecasts.
  Endpoint:  JSON-RPC at http://localhost:41241/agents/weather/a2a/jsonrpc (A2A 1.0)
  Streaming: yes
  Skills:
    Weather forecast: The current weather and a daily forecast for a city: conditions, temperatures, rain and wind, with practical advice.
      e.g. Do I need an umbrella in Lisbon tomorrow?

Type a question, or /help for the commands.

Weather Agent > You: Will it rain in Springfield tomorrow?
  … Looking into it…
  … Calling find_city {"name":"Springfield"}
Agent: I found several places called Springfield. Which one do you mean?
- Springfield, Missouri
- Springfield, Illinois
- Springfield, Massachusetts
  (answer to continue, or /new to start over)
Weather Agent > You: Illinois
  … Looking into it…
  … Calling get_forecast {"latitude":39.80172,"longitude":-89.64371,"days":2}
Agent: It probably won't rain in Springfield, Illinois tomorrow, but heavy snow is very likely.
- Temperature: -4.1 to 3.8 °C
- Chance of snow: 96%, about 18.7 mm
Wear a warm coat, gloves and waterproof boots.
  ✓ done
```

## How a message runs

On the weather agent:

1. The CLI sends the line with `sendMessageStream`, in the conversation's `contextId`, and in its `taskId` when the agent is waiting for an answer.
2. `TurnAgentExecutor` publishes the task (`SUBMITTED`, then `WORKING`) and runs one Claude Agent SDK `query()`, resuming the Claude session the `SessionStore` holds for that `contextId`.
3. Claude calls `find_city` and `get_forecast`, two in-process MCP tools backed by the Open-Meteo client. It has no other tools, built-in ones included, and loads none of the machine's Claude settings. Each tool call is streamed as a `WORKING` update.
4. Claude ends every turn with a structured answer, `{ outcome, text }`, which the Claude Agent SDK enforces with a JSON schema. Where the movie-agent sample reads a marker off the answer's last line, the outcome here is a field. `completed` publishes the answer as a `forecast` artifact and ends the task. `input-required` ends it `INPUT_REQUIRED`, with the agent's question on the status.

On the trip planner, the same executor runs a Codex turn instead:

1. The Codex runner starts a Codex thread, or resumes the one the `SessionStore` holds for the `contextId`, and runs the message with developer instructions dated per turn. Codex has no tools: no MCP servers, no web search, no network, and a read-only sandbox in an empty folder (its shell cannot be switched off, so it is boxed in instead).
2. Codex ends every run with a structured answer that the Codex CLI enforces with a JSON schema: `{ outcome, text }`, where the outcome can also be `consult`, with a question for the weather agent. The thread id is the turn's session; Codex's reasoning is streamed as `WORKING` updates.
3. On `consult`, the runner asks the weather agent over A2A, from the weather-agent client, and streams the weather agent's own updates as the trip planner's. Then it runs the same thread again with the reply ("The Weather Agent answered: …"), up to three times a turn.
4. When the weather agent asks back, Codex gets its question and decides: it asks you, and ends the task `INPUT_REQUIRED`. Your answer resumes the thread, Codex consults again, and the weather-agent client sends that question in the weather agent's waiting task, so the weather agent carries on where it stopped. Each Codex thread keeps its own weather conversation.
5. `completed` publishes the answer as a `trip-plan` artifact and ends the task.

## Layout

A pnpm workspace. The two apps meet only over A2A and never import each other.

```text
apps/server/src          the server: an Express app, and the agents it serves
  server.ts              composition root: configuration, weatherAgent and tripPlannerAgent, the listener
  app.ts                 createApp(context): logging, /health, each agent's A2A card and JSON-RPC endpoint, 404 and errors
  controllers/           health.controller.ts
  middlewares/           not-found and error handlers
  models/, helpers/      AppContext, configuration
  agents/
    core/                what every agent shares
      a2a-agent.ts       its entry point: createA2aAgent, an agent ready to serve; and what agents may use from core
      executors/         turn-agent.executor.ts: the A2A AgentExecutor, for any agent that answers in turns
      runners/           claude.runner.ts and codex.runner.ts: one turn on the Claude Agent SDK or the Codex SDK, as turn events
      stores/            session.store.ts: the Claude session or Codex thread of each A2A context
      models/, helpers/  turn events, AgentDefinition and A2aAgent, A2A messages
    weather/             the weather agent
      weather.agent.ts   its entry point: weatherAgent(options), on Claude with its card, prompt, tools and forecast answer
      clients/           open-meteo.client.ts
      tools/             weather.tool.ts: find_city and get_forecast
      prompts/           weather.prompt.ts: the instructions
      models/, helpers/  places and forecasts, weather codes and formatting
    trip-planner/        the trip planner
      trip-planner.agent.ts  its entry point: tripPlannerAgent(options), on Codex with its card, instructions and the weather agent to consult
      clients/           weather-agent.client.ts: the weather agent over A2A
      prompts/           trip-planner.prompt.ts: the instructions
apps/client/src          the A2A terminal client
  main.ts                entry point: flags, connection, the read loop
  args.ts                flags and usage
  card.ts                the Agent Card summary
  render.ts, parts.ts    events and parts as lines, compact or verbose
  conversation.ts        the task and context ids between messages
  commands.ts            /new, /help, /exit
  style.ts               terminal colours, or none
tooling/                 the shared tsconfig and ESLint config
```

The Express app and the agents are kept apart, and lint enforces it: the app reaches an agent only through its entry point, nothing in `agents/` imports Express, `core/` imports no agent, an agent reaches core only through `core/a2a-agent.ts`, and agents never import each other: the trip planner reaches the weather agent over HTTP, at the URL `server.ts` hands it. [`coding-conventions.md`](coding-conventions.md) says what each block may hold, and how to add an agent or a new kind of code.

## Checks

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm format:check
```

```bash
pnpm test:integration
```

`pnpm test` runs the unit tests of every package; `pnpm test:integration` drives the server's endpoints over HTTP. Neither calls Claude, Codex or Open-Meteo: the tests run on recorded samples and fakes, and the API tests run the trip planner's calls to the weather agent over real HTTP.

## Notes

- **Open-Meteo's free API is rate-limited per IP.** When it refuses a request, the agent says so instead of guessing; try again later, or see Open-Meteo's terms for heavier use.
- **Behind an HTTPS proxy**, start the agent with `NODE_USE_ENV_PROXY=1`, since Node's built-in `fetch` does not read `HTTPS_PROXY` otherwise.
- **Everything is in memory**: tasks, the `contextId` to Claude session and Codex thread maps, and the trip planner's weather conversations are lost when the server restarts. Codex itself keeps its threads in `~/.codex/sessions`.
- **Codex reads the machine's Codex config**: unlike the Claude runner, which loads none of the machine's settings, the Codex CLI reads `~/.codex/config.toml`. MCP servers configured there would reach the trip planner, so keep them out of the config on a machine that serves it.
- **No authentication**: anyone who can reach the server runs Claude and Codex on your credentials through it. Keep it on localhost.
