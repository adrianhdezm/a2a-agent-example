import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AgentRegistry, summarizeAgent } from '@a2a-agent-example/agent-registry';
import { ClaudeHarness } from '@a2a-agent-example/harness-claude';
import { CodexHarness } from '@a2a-agent-example/harness-codex';
import { HarnessRegistry } from '@a2a-agent-example/harness-core';
import { registerStarterAgents } from './agents.ts';
import { createApp } from './app.ts';
import { readConfig } from './config.ts';

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
createApp({ agents, harnesses, baseUrl }).listen(config.port, (error) => {
  if (error) {
    throw error;
  }
  console.log(`A2A agent server listening on ${baseUrl}`);
  for (const agent of agents.list()) {
    console.log(`  ${agent.id} (${agent.harness}): ${summarizeAgent(agent, baseUrl).cardUrl}`);
  }
});
