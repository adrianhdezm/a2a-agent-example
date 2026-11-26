# a2a-agent-example

A weather agent built on the [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview), served over [A2A 1.0](https://a2a-protocol.org/v1.0.0/specification/) with [`@a2a-js/sdk`](https://github.com/a2aproject/a2a-js), and an interactive command line to talk to it.

It follows the shape of the a2a-js [`movie-agent`](https://github.com/a2aproject/a2a-js/tree/main/src/samples/agents/movie-agent) and [`cli.ts`](https://github.com/a2aproject/a2a-js/blob/main/src/samples/cli.ts) samples, with the Claude Agent SDK in place of Genkit and [Open-Meteo](https://open-meteo.com) in place of TMDB. Open-Meteo needs no API key, so the only key is Anthropic's.

What it shows of A2A:

- **An Agent Card** at `/.well-known/agent-card.json`, with one JSON-RPC interface and one skill.
- **Streaming**: the agent's tool calls arrive as `TASK_STATE_WORKING` updates while it works.
- **`input-required`**: when the question is ambiguous ("Springfield?"), the agent asks back, and the answer continues the same task.
- **Multi-turn conversations**: every message in a `contextId` resumes the same Claude session, so the agent remembers what was said.
- **Cancellation**: `cancelTask` aborts the running Claude turn and ends the task `TASK_STATE_CANCELED`.

## Run it

You need Node 24 or newer and pnpm 11 or newer (`corepack enable` gives you the version `package.json` names).

```bash
pnpm install
```

```bash
cp .env.example .env
```

Put your Anthropic API key in `.env` as `ANTHROPIC_API_KEY`, then start the agent:

```bash
pnpm dev
```

In a second terminal, start the command line:

```bash
pnpm cli
```

`pnpm cli` is a general A2A terminal client: it connects to the agent on the `PORT` in `.env`, or to any A2A agent whose URL you pass (`pnpm cli http://localhost:41241`). `pnpm cli --help` lists its flags:

| Flag                 | Does                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------- |
| `--verbose`          | Heads every event with its time, state, task and context, and says when a task is final |
| `--card-path <path>` | Reads the Agent Card from another path than `.well-known/agent-card.json`               |

In the session, `/help` lists the commands, `/new` starts a new conversation, `/exit` quits, and Ctrl+C cancels the answer in progress. Answers show every kind of A2A part: text as it is, links and raw bytes described, data as JSON.

A session looks like this:

```text
Weather Agent v0.1.0
Answers questions about the weather now and for the next 7 days anywhere in the world, from Open-Meteo forecasts.
  Endpoint:  JSON-RPC at http://localhost:41241/a2a/jsonrpc (A2A 1.0)
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
2. `TurnAgentExecutor` publishes the task (`SUBMITTED`, then `WORKING`) and runs one Claude Agent SDK `query()`, resuming the Claude session the `SessionStore` holds for that `contextId`.
3. Claude calls `find_city` and `get_forecast`, two in-process MCP tools backed by the Open-Meteo client. It has no other tools, built-in ones included, and loads none of the machine's Claude settings. Each tool call is streamed as a `WORKING` update.
4. Claude ends every turn with a structured answer, `{ outcome, text }`, which the Claude Agent SDK enforces with a JSON schema. Where the movie-agent sample reads a marker off the answer's last line, the outcome here is a field. `completed` publishes the answer as a `forecast` artifact and ends the task. `input-required` ends it `INPUT_REQUIRED`, with the agent's question on the status.

## Layout

A pnpm workspace. The two apps meet only over A2A and never import each other.

```text
apps/server/src          the server: an Express app, and the agents it serves
  server.ts              composition root: configuration, weatherAgent({ apiKey, baseUrl }), the listener
  app.ts                 createApp(context): logging, /health, the A2A card and JSON-RPC endpoint, 404 and errors
  controllers/           health.controller.ts
  middlewares/           not-found and error handlers
  models/, helpers/      AppContext, configuration
  agents/
    core/                what every agent shares
      factories/         a2a-agent.factory.ts: an agent ready to serve, its card completed with where it is served
      executors/         turn-agent.executor.ts: the A2A AgentExecutor, for any agent that answers in turns
      runners/           claude.runner.ts: one turn on the Claude Agent SDK, as turn events
      stores/            session.store.ts: the Claude session of each A2A context
      models/, helpers/  turn events, AgentDefinition and A2aAgent, A2A messages
    weather/             the weather agent
      weather.agent.ts   its entry point: weatherAgent(options), on Claude with its card, prompt, tools and forecast answer
      clients/           open-meteo.client.ts
      tools/             weather.tool.ts: find_city and get_forecast
      prompts/           weather.prompt.ts: the instructions
      models/, helpers/  places and forecasts, weather codes and formatting
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

The Express app and the agents are kept apart, and lint enforces it: the app reaches an agent only through its entry point, nothing in `agents/` imports Express, `core/` imports no agent, and agents never import each other. [`coding-conventions.md`](coding-conventions.md) says what each block may hold, and how to add an agent or a new kind of code.

## Checks

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm format:check
```

```bash
pnpm test:integration
```

`pnpm test` runs the unit tests of every package; `pnpm test:integration` drives the server's endpoints over HTTP. Neither calls Claude or Open-Meteo: the tests run on recorded samples and fakes.

## Notes

- **Open-Meteo's free API is rate-limited per IP.** When it refuses a request, the agent says so instead of guessing; try again later, or see Open-Meteo's terms for heavier use.
- **Behind an HTTPS proxy**, start the agent with `NODE_USE_ENV_PROXY=1`, since Node's built-in `fetch` does not read `HTTPS_PROXY` otherwise.
- **Everything is in memory**: tasks and the `contextId` to Claude session map are lost when the agent restarts.
- **No authentication**: anyone who can reach the agent can use your Anthropic key through it. Keep it on localhost.
