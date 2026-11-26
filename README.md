# a2a-agent-example

Two agents served over [A2A 1.0](https://a2a-protocol.org/v1.0.0/specification/) with [`@a2a-js/sdk`](https://github.com/a2aproject/a2a-js), on any of three agent SDKs, and an interactive command line to talk to them:

- a **weather agent**, with two tools over [Open-Meteo](https://open-meteo.com);
- a **trip planner**, with one tool that asks the weather agent over A2A, as any A2A client would.

Each agent runs on a **runner**, picked in `.env`: the [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview), the [Codex SDK](https://github.com/openai/codex/tree/main/sdk/typescript) or [Pi](https://github.com/badlogic/pi-mono/tree/main/packages/agent). The runners are strategies of one interface: an agent is defined once (instructions, tools, a step limit), any runner runs it, and every runner reports a turn as the same events, so the A2A side does not know which SDK answers. One contract test suite runs against all three to keep it so.

It follows the shape of the a2a-js [`movie-agent`](https://github.com/a2aproject/a2a-js/tree/main/src/samples/agents/movie-agent) and [`cli.ts`](https://github.com/a2aproject/a2a-js/blob/main/src/samples/cli.ts) samples, with agent SDKs in place of Genkit and Open-Meteo, which needs no API key, in place of TMDB.

What it shows of A2A:

- **An Agent Card per agent**, at `/agents/weather/.well-known/agent-card.json` and `/agents/trip-planner/.well-known/agent-card.json`, each with one JSON-RPC interface and one skill.
- **An agent calling an agent**: the trip planner's `ask_weather_agent` tool is an A2A client of the weather agent.
- **Streaming**: the agent's tool calls arrive as `TASK_STATE_WORKING` updates while it works.
- **`input-required`**: when the question is ambiguous ("Springfield?"), the agent asks back, and the answer continues the same task. Through the trip planner, the weather agent's question reaches you, and your answer continues the weather agent's task.
- **Multi-turn conversations**: every message in a `contextId` resumes the same SDK session (a Claude session, a Codex thread, a Pi transcript), so the agent remembers what was said.
- **Cancellation**: `cancelTask` aborts the running turn and ends the task `TASK_STATE_CANCELED`; cancelling the trip planner also cancels the weather agent's task it is waiting on.

## Run it

You need Node 24 or newer and pnpm 11 or newer (`corepack enable` gives you the version `package.json` names).

```bash
pnpm install
```

```bash
cp .env.example .env
```

`.env` picks each agent's runner, `WEATHER_AGENT_RUNNER` and `TRIP_PLANNER_RUNNER`: `claude`, `codex` or `pi`. `WEATHER_AGENT_MODEL` and `TRIP_PLANNER_MODEL` pick the model, and may stay unset for Claude and Codex, which then use their own default. `.env.example` runs the weather agent on Claude and the trip planner on Codex. Each runner signs in its own way:

| Runner   | Signs in                                                                                                                       | Model                                                        |
| -------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `claude` | the way Claude Code does on this machine; or `ANTHROPIC_API_KEY` in `.env`                                                     | optional: a Claude model id                                  |
| `codex`  | the way the Codex CLI installed with the SDK does: `codex login` (`pnpm --filter server exec codex login`); or `CODEX_API_KEY` | optional: an OpenAI model id                                 |
| `pi`     | with the provider's API key in `.env`, as pi-ai reads it: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, …                             | required, as `provider/model`: `anthropic/claude-sonnet-4-6` |

Then start both agents:

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

A session with the trip planner looks like this, trimmed (what the model writes varies from run to run, and from runner to runner):

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
  … Calling ask_weather_agent {"question":"What is the weather in Springfield on Monday?"}
Agent: There are several Springfields. Which one are you going to: Illinois, Missouri or Massachusetts?
  (answer to continue, or /new to start over)
Trip Planner > You: Illinois
  … Looking into it…
  … Calling ask_weather_agent {"question":"Springfield, Illinois"}
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

1. The CLI sends the line with `sendMessageStream`, in the conversation's `contextId`, and in its `taskId` when the agent is waiting for an answer.
2. `TurnAgentExecutor` publishes the task (`SUBMITTED`, then `WORKING`) and runs one turn on the agent's runner, resuming the SDK session the `SessionStore` holds for that `contextId`. It knows the `Runner` interface only.
3. The runner gives the model the agent's tools and nothing else: no built-in tools, none of the machine's settings. Each tool call is streamed as a `WORKING` update, worded the same on every runner (`Calling find_city {"name":"Lisbon"}`).
4. The model ends every turn with a structured answer, `{ outcome, text }`. Where the movie-agent sample reads a marker off the answer's last line, the outcome here is a field. `completed` publishes the answer as an artifact (`forecast`, `trip-plan`) and ends the task. `input-required` ends it `INPUT_REQUIRED`, with the agent's question on the status.

What each runner does to keep that contract:

|                | Claude Agent SDK                    | Codex SDK                                                                                         | Pi (`pi-agent-core`)                                                          |
| -------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Tools**      | an in-process MCP server            | the agent's tools over MCP at `/agents/<id>/mcp/<contextId>`, which the Codex CLI connects to     | Pi tools, in process                                                          |
| **Answer**     | the SDK's JSON schema output format | the Codex CLI's output schema                                                                     | a call to an `answer` tool, which ends the turn (Pi has no structured output) |
| **Session**    | the Claude session, resumed         | the Codex thread, resumed                                                                         | the transcript, kept by the runner, since Pi keeps none                       |
| **Step limit** | the SDK's `maxTurns`                | the runner counts tool calls and stops the run, since Codex has no limit of its own               | the loop stops after the agent's `maxSteps` model calls                       |
| **Built-ins**  | `tools: []`, `settingSources: []`   | read-only sandbox in an empty folder, no network or web search (its shell cannot be switched off) | none                                                                          |

When the trip planner calls `ask_weather_agent`, the tool sends the question to the weather agent over A2A and hands its answer back to the model. If the weather agent asks back ("Which Springfield?"), the tool hands back its question, and the model asks you. Your answer comes in the same `contextId`, the model calls the tool again, and the tool sends the answer in the weather agent's waiting task, so the weather agent carries on where it stopped. Each A2A context keeps its own conversation with the weather agent.

## Layout

A pnpm workspace. The two apps meet only over A2A and never import each other.

```text
apps/server/src          the server: an Express app, and the agents it serves
  server.ts              composition root: configuration, each agent on its runner, the listener
  app.ts                 createApp(context): logging, /health, each agent's A2A card, JSON-RPC endpoint and MCP tools, 404 and errors
  controllers/           health.controller.ts
  middlewares/           not-found and error handlers
  models/, helpers/      AppContext, configuration
  agents/
    core/                what every agent shares
      a2a-agent.ts       its entry point: createA2aAgent and resolveRunner; and what agents may use from core
      executors/         turn-agent.executor.ts: the A2A AgentExecutor, on any runner
      runners/           claude.runner.ts, codex.runner.ts, pi.runner.ts: one turn on an agent SDK, as turn events
      handlers/          tools-mcp.handler.ts: an agent's tools over MCP, for the Codex runner
      tools/             ask-agent.tool.ts: a tool that asks another A2A agent
      stores/            session.store.ts (the SDK session of each A2A context), pi-transcript.store.ts
      models/, helpers/  turn events, the Runner interface and AgentSpec, AgentTool, the answer format, A2A messages
    weather/             the weather agent
      weather.agent.ts   its entry point: weatherAgent(options), its card, prompt, tools and forecast answer, on the runner it is given
      clients/           open-meteo.client.ts
      tools/             weather.tool.ts: find_city and get_forecast
      prompts/           weather.prompt.ts: the instructions
      models/, helpers/  places and forecasts, weather codes and formatting
    trip-planner/        the trip planner
      trip-planner.agent.ts  its entry point: tripPlannerAgent(options), its card, instructions and ask_weather_agent, on the runner it is given
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

`pnpm test` runs the unit tests of every package; `pnpm test:integration` drives the server's endpoints over HTTP. Neither calls a model or Open-Meteo: the tests run on recorded samples and fakes. The runner contract (`tests/unit/agents/core/runners/runner-contract.ts`) plays the same turns on all three runners, each through a fake of its SDK; Pi's is its own agent loop on its fake provider, so its tools really run. The API tests run the trip planner on Pi that way, so its calls to the weather agent go over real HTTP.

## Notes

- **Open-Meteo's free API is rate-limited per IP.** When it refuses a request, the agent says so instead of guessing; try again later, or see Open-Meteo's terms for heavier use.
- **Behind an HTTPS proxy**, start the agent with `NODE_USE_ENV_PROXY=1`, since Node's built-in `fetch` does not read `HTTPS_PROXY` otherwise.
- **Everything is in memory**: tasks, the `contextId` to SDK session maps, Pi's transcripts and the trip planner's weather conversations are lost when the server restarts. Claude and Codex keep their own sessions on disk (`~/.claude`, `~/.codex/sessions`).
- **Codex reads the machine's Codex config**: unlike the Claude and Pi runners, which load none of the machine's settings, the Codex CLI reads `~/.codex/config.toml`. MCP servers configured there would reach an agent on Codex, so keep them out of the config on a machine that serves it.
- **No authentication**: anyone who can reach the server runs the models on your credentials through it, and calls the agents' tools at their MCP endpoints. Keep it on localhost.
