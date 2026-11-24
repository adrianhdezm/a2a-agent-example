import { query } from '@anthropic-ai/claude-agent-sdk';
import { agentPaths, weatherAgentCard } from './agent-card.ts';
import { createApp } from './app.ts';
import { runClaudeTurn } from './claude-turn.ts';
import { readPort, requireVariable } from '../shared/config.ts';
import { openMeteo } from './open-meteo.ts';
import { WeatherAgentExecutor } from './weather-agent-executor.ts';
import { weatherInstructions } from './weather-prompt.ts';
import { weatherMcpServer, weatherServerName, weatherToolNames } from './weather-tools.ts';

// Enough round trips for a city lookup, a forecast or two and the answer, with room to ask back.
const maxTurns = 8;

const port = readPort(process.env);
const apiKey = requireVariable(process.env, 'ANTHROPIC_API_KEY');
const baseUrl = `http://localhost:${String(port)}`;

const settings = {
  apiKey,
  systemPrompt: () => weatherInstructions(new Date()),
  mcpServers: { [weatherServerName]: weatherMcpServer(openMeteo()) },
  allowedTools: weatherToolNames,
  maxTurns,
  query
};
const executor = new WeatherAgentExecutor((request) => runClaudeTurn(settings, request));
const card = weatherAgentCard(baseUrl);

const server = createApp(card, executor).listen(port, (error) => {
  if (error) {
    throw error;
  }
  console.log(`${card.name} listening on ${baseUrl}`);
  console.log(`Agent Card: ${baseUrl}${agentPaths.card}`);
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
