import { tripPlannerAgent } from './agents/trip-planner/trip-planner.agent.ts';
import { weatherAgent } from './agents/weather/weather.agent.ts';
import { createApp } from './app.ts';
import { readPort } from './helpers/config.helper.ts';
import { logger } from './logger.ts';

const port = readPort(process.env);
const baseUrl = `http://localhost:${String(port)}`;

// Each agent names its own runner: the weather agent runs on Claude, the trip planner on Codex. The trip planner
// reaches the weather agent the way any A2A client would: at its URL, over HTTP.
const weather = weatherAgent({ baseUrl });
const tripPlanner = tripPlannerAgent({ baseUrl, weatherAgentUrl: weather.url });
const agents = [weather, tripPlanner];

const server = createApp({ agents }).listen(port, (error) => {
  if (error) {
    throw error;
  }
  for (const agent of agents) {
    logger.info({ url: agent.url }, `${agent.card.name} listening`);
  }
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
