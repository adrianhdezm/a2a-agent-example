import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { serveTestApp } from '../utils/test-app.ts';
import type { TestServer } from '../utils/test-server.ts';

describe('GET /health', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await serveTestApp();
  });

  afterAll(async () => {
    await server.close();
  });

  it('answers ok with the current time', async () => {
    const response = await fetch(`${server.baseUrl}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok', timestamp: expect.any(String) as unknown });
  });
});
