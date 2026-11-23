import type { HarnessEvent } from '@a2a-agent-example/harness-core';
import { createApp } from '../../src/app.ts';
import { testContext } from './test-context.ts';
import { listen } from './test-server.ts';
import type { TestServer } from './test-server.ts';

/** The real app on an ephemeral port, built around the test context; every harness turn answers with `events`. */
export async function serveTestApp(events: HarnessEvent[] = []): Promise<TestServer> {
  const server = await listen();
  server.serve(createApp(testContext(server.baseUrl, events)));
  return server;
}
