import { weatherAgent } from './agents/weather/weather.agent.ts';
import { createApp } from './app.ts';
import { readPort, requireVariable } from './helpers/config.helper.ts';
import { logger } from './logger.ts';

const port = readPort(process.env);
const apiKey = requireVariable(process.env, 'ANTHROPIC_API_KEY');
const baseUrl = `http://localhost:${String(port)}`;

const agent = weatherAgent({ apiKey, baseUrl });

const server = createApp({ agent }).listen(port, (error) => {
  if (error) {
    throw error;
  }
  logger.info({ baseUrl, card: `${baseUrl}${agent.paths.card}` }, `${agent.card.name} listening`);
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
