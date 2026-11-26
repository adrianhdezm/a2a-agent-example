import { query } from '@anthropic-ai/claude-agent-sdk';
import { DefaultRequestHandler, InMemoryTaskStore } from '@a2a-js/sdk/server';
import { TurnAgentExecutor } from './agents/core/executors/turn-agent.executor.ts';
import { agentPaths } from './agents/core/helpers/agent-card.helper.ts';
import { runClaudeTurn } from './agents/core/runners/claude.runner.ts';
import type { ClaudeTurnSettings } from './agents/core/runners/claude.runner.ts';
import { SessionStore } from './agents/core/stores/session.store.ts';
import { openMeteoClient } from './agents/weather/clients/open-meteo.client.ts';
import { weatherAgent } from './agents/weather/weather.agent.ts';
import { createApp } from './app.ts';
import { readPort, requireVariable } from './helpers/config.helper.ts';
import { logger } from './logger.ts';

const port = readPort(process.env);
const apiKey = requireVariable(process.env, 'ANTHROPIC_API_KEY');
const baseUrl = `http://localhost:${String(port)}`;

// The agent, run on Claude and served over A2A: one executor, its sessions and its task store.
const { card: cardAt, answerArtifact, ...agentTurns } = weatherAgent(openMeteoClient());
const claude: ClaudeTurnSettings = { ...agentTurns, apiKey, query };
const executor = new TurnAgentExecutor({
  runTurn: (request) => runClaudeTurn(claude, request),
  sessions: new SessionStore(),
  answerArtifact
});
const card = cardAt(baseUrl);
const requestHandler = new DefaultRequestHandler(card, new InMemoryTaskStore(), executor);

const server = createApp({ requestHandler }).listen(port, (error) => {
  if (error) {
    throw error;
  }
  logger.info({ baseUrl, card: `${baseUrl}${agentPaths.card}` }, `${card.name} listening`);
});

// Stop taking requests, let the open ones (running turns among them) finish, then exit.
function shutdown(signal: string): void {
  logger.info({ signal }, 'shutting down');
  server.close((error) => {
    if (error) {
      logger.error({ err: error }, 'the server did not close cleanly');
      process.exit(1);
    }
    process.exit(0);
  });
}

process.on('SIGINT', () => {
  shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});
