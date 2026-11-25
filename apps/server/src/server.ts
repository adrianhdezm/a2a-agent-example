import { query } from '@anthropic-ai/claude-agent-sdk';
import { DefaultRequestHandler, InMemoryTaskStore } from '@a2a-js/sdk/server';
import { createApp } from './app.ts';
import { runClaudeTurn } from './clients/claude.client.ts';
import type { ClaudeTurnSettings } from './clients/claude.client.ts';
import { openMeteoClient } from './clients/open-meteo.client.ts';
import { WeatherAgentExecutor } from './executors/weather-agent.executor.ts';
import { agentPaths, weatherAgentCard } from './helpers/agent-card.helper.ts';
import { readPort, requireVariable } from './helpers/config.helper.ts';
import { logger } from './logger.ts';
import { weatherInstructions } from './prompts/weather.prompt.ts';
import { SessionStore } from './stores/session.store.ts';
import { weatherMcpServer, weatherServerName, weatherToolNames } from './tools/weather.tool.ts';

// Enough round trips for a city lookup, a forecast or two and the answer, with room to ask back.
const maxTurns = 8;

const port = readPort(process.env);
const apiKey = requireVariable(process.env, 'ANTHROPIC_API_KEY');
const baseUrl = `http://localhost:${String(port)}`;

const claude: ClaudeTurnSettings = {
  apiKey,
  systemPrompt: () => weatherInstructions(new Date()),
  mcpServers: { [weatherServerName]: weatherMcpServer(openMeteoClient()) },
  allowedTools: weatherToolNames,
  maxTurns,
  query
};
const executor = new WeatherAgentExecutor((request) => runClaudeTurn(claude, request), new SessionStore());
const card = weatherAgentCard(baseUrl);
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
