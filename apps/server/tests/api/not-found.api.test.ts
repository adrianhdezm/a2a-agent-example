import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { serveTestApp } from '../utils/test-app.ts';
import type { TestServer } from '../utils/test-server.ts';

describe('unmatched paths', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await serveTestApp();
  });

  afterAll(async () => {
    await server.close();
  });

  it('answers an unmatched path with a 404 in the standard error shape', async () => {
    const response = await fetch(`${server.baseUrl}/nowhere`, { method: 'DELETE' });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ status: 'error', message: 'Not Found: DELETE /nowhere' });
  });
});
