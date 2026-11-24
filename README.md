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

`pnpm cli` connects to the agent on the `PORT` in `.env`; pass another agent's URL to talk to it instead (`pnpm cli http://localhost:41241`).

A session looks like this:

```text
Weather Agent: Answers questions about the weather now and for the next 7 days anywhere in the world, from Open-Meteo forecasts.
Type a question. /new starts a new conversation, /exit quits, Ctrl+C cancels a running answer.

You: Will it rain in Springfield tomorrow?
  … Looking into it…
  … Calling find_city {"name":"Springfield"}
Agent: I found several places called Springfield. Which one do you mean?
- Springfield, Missouri
- Springfield, Illinois
- Springfield, Massachusetts
  (answer to continue, or /new to start over)
You: Illinois
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
2. `WeatherAgentExecutor` publishes the task (`SUBMITTED`, then `WORKING`) and runs one Claude Agent SDK `query()`, resuming the Claude session it saved for that `contextId`.
3. Claude calls `find_city` and `get_forecast`, two in-process MCP tools backed by Open-Meteo. It has no other tools, built-in ones included, and loads none of the machine's Claude settings. Each tool call is streamed as a `WORKING` update.
4. As in the movie-agent sample, the answer's last line says how the turn ended. `COMPLETED` publishes the answer as a `forecast` artifact and ends the task. `AWAITING_USER_INPUT` ends it `INPUT_REQUIRED`, with the agent's question on the status.

| File                                                 | Does                                                                                            |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `src/server.ts`                                      | Starts the agent: configuration, tools, executor, card, Express                                 |
| `src/weather-agent-executor.ts`                      | The A2A `AgentExecutor`: one Claude turn per message, streaming, `input-required`, cancellation |
| `src/claude-turn.ts`                                 | One Claude Agent SDK `query()` and its messages as turn events                                  |
| `src/weather-tools.ts`                               | The `find_city` and `get_forecast` tools                                                        |
| `src/open-meteo.ts`                                  | The Open-Meteo geocoding and forecast client, its answers validated with zod                    |
| `src/weather-prompt.ts`                              | The system prompt and the end-of-turn marker                                                    |
| `src/agent-card.ts`, `src/app.ts`                    | The Agent Card and the Express app around the SDK's handlers                                    |
| `src/cli.ts`, `src/conversation.ts`, `src/render.ts` | The command line, its conversation state and how it prints events                               |

## Checks

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm format:check
```

`pnpm test` never calls Claude or Open-Meteo: the tests run on recorded samples and fakes. The project's rules are in [`coding-conventions.md`](coding-conventions.md).

## Notes

- **Open-Meteo's free API is rate-limited per IP.** When it refuses a request, the agent says so instead of guessing; try again later, or see Open-Meteo's terms for heavier use.
- **Behind an HTTPS proxy**, start the agent with `NODE_USE_ENV_PROXY=1`, since Node's built-in `fetch` does not read `HTTPS_PROXY` otherwise.
- **Everything is in memory**: tasks and the `contextId` to Claude session map are lost when the agent restarts.
- **No authentication**: anyone who can reach the agent can use your Anthropic key through it. Keep it on localhost.
