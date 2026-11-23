import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ClaudeHarness } from '@a2a-agent-example/harness-claude';
import { CodexHarness } from '@a2a-agent-example/harness-codex';
import { HarnessRegistry } from '@a2a-agent-example/harness-core';
import { AgentRegistry } from './agent-registry.ts';
import { summarizeAgent } from './agent-summary.ts';
import { createApp } from './app.ts';
import { readConfig } from './config.ts';
import { logger } from './logger.ts';
import { registerStarterAgents } from './starter-agents.ts';

// A generous bound on model round trips per harness turn, so a confused agent stops instead of looping.
const claudeMaxTurns = 30;

const config = readConfig(process.env);

const harnesses = new HarnessRegistry();
harnesses.register(new ClaudeHarness({ apiKey: config.anthropicApiKey, maxTurns: claudeMaxTurns }));
harnesses.register(new CodexHarness({ apiKey: config.codexApiKey }));

const agents = new AgentRegistry(harnesses);
registerStarterAgents(agents, resolve(import.meta.dirname, '../workspaces'));
await Promise.all(agents.list().map((agent) => mkdir(agent.workspace, { recursive: true })));

const baseUrl = `http://localhost:${String(config.port)}`;
const server = createApp({ agents, harnesses, baseUrl }).listen(config.port, (error) => {
  if (error) {
    throw error;
  }
  logger.info({ baseUrl }, 'A2A agent server listening');
  for (const agent of agents.list()) {
    logger.info({ agent: agent.id, harness: agent.harness, cardUrl: summarizeAgent(agent, baseUrl).cardUrl }, 'agent mounted');
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
