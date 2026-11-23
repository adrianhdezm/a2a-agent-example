import { resolve } from 'node:path';
import { ClaudeHarness } from '@a2a-agent-example/claude-driver';
import { CodexHarness } from '@a2a-agent-example/codex-driver';
import { HarnessRegistry } from '@a2a-agent-example/harness';
import { createApp } from './app.ts';
import { readConfig } from './helpers/config.helper.ts';
import { logger } from './logger.ts';
import { AgentRuntime } from './runtimes/agent.runtime.ts';
import { AgentStore } from './stores/agent.store.ts';
import { AgentService } from './services/agent.service.ts';

// A generous bound on model round trips per harness turn, so a confused agent stops instead of looping.
const claudeMaxTurns = 30;

const config = readConfig(process.env);

const harnessRegistry = new HarnessRegistry();
harnessRegistry.register(new ClaudeHarness({ apiKey: config.anthropicApiKey, maxTurns: claudeMaxTurns }));
harnessRegistry.register(new CodexHarness({ apiKey: config.codexApiKey }));

const baseUrl = `http://localhost:${String(config.port)}`;
const agentRuntime = new AgentRuntime({ harnessRegistry, baseUrl });
const agentService = new AgentService({
  agentStore: new AgentStore(),
  agentRuntime,
  harnessRegistry,
  workspacesDir: resolve(import.meta.dirname, '../workspaces')
});

// The server starts with no agents: clients create them through POST /agents (`pnpm agents seed` creates the starters).
const server = createApp({ agentService, agentRuntime, baseUrl }).listen(config.port, (error) => {
  if (error) {
    throw error;
  }
  logger.info({ baseUrl }, 'A2A agent server listening');
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
