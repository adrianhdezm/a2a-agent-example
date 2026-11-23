import type { HarnessEvent } from '@a2a-agent-example/harness-core';
import type { FakeHarness } from '@a2a-agent-example/harness-core/testing';
import { createApp } from '../../src/app.ts';
import { testContext } from './test-context.ts';
import { listen } from './test-server.ts';
import type { TestServer } from './test-server.ts';

export interface TestApp extends TestServer {
  /** The harness behind every agent, to see what the endpoints made it do. */
  harness: FakeHarness;
}

/** The real app on an ephemeral port around the test context; every harness turn answers with `events`. */
export async function serveTestApp(events: HarnessEvent[] = []): Promise<TestApp> {
  const server = await listen();
  const { context, harness } = await testContext(server.baseUrl, events);
  server.serve(createApp(context));
  return { ...server, harness };
}
