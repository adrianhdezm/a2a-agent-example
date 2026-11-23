import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ClaudeHarness } from '@a2a-agent-example/harness-claude';
import { CodexHarness } from '@a2a-agent-example/harness-codex';
import { HarnessRegistry } from '@a2a-agent-example/harness-core';
import { claudeCoderAgent } from './agents/claude-coder.agent.ts';
import { codexCoderAgent } from './agents/codex-coder.agent.ts';
import { createApp } from './app.ts';
import { summarizeAgent } from './helpers/agent-url.helper.ts';
import { readConfig } from './helpers/config.helper.ts';
import { logger } from './logger.ts';
import { AgentRegistry } from './registries/agent.registry.ts';

// A generous bound on model round trips per harness turn, so a confused agent stops instead of looping.
const claudeMaxTurns = 30;

const config = readConfig(process.env);

const harnessRegistry = new HarnessRegistry();
harnessRegistry.register(new ClaudeHarness({ apiKey: config.anthropicApiKey, maxTurns: claudeMaxTurns }));
harnessRegistry.register(new CodexHarness({ apiKey: config.codexApiKey }));

const workspacesDir = resolve(import.meta.dirname, '../workspaces');
const agentRegistry = new AgentRegistry(harnessRegistry);
agentRegistry.register(claudeCoderAgent(workspacesDir));
agentRegistry.register(codexCoderAgent(workspacesDir));
await Promise.all(agentRegistry.list().map((agent) => mkdir(agent.workspace, { recursive: true })));

const baseUrl = `http://localhost:${String(config.port)}`;
const server = createApp({ agentRegistry, harnessRegistry, baseUrl }).listen(config.port, (error) => {
  if (error) {
    throw error;
  }
  logger.info({ baseUrl }, 'A2A agent server listening');
  for (const agent of agentRegistry.list()) {
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
