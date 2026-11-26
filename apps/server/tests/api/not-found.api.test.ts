import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { serveTestApp } from '../utils/test-app.ts';
import type { TestApp } from '../utils/test-app.ts';

describe('unmatched paths', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await serveTestApp([[]]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers a path the server does not serve with a 404 in the standard error shape', async () => {
    const response = await fetch(`${app.baseUrl}/agents`, { method: 'DELETE' });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ status: 'error', message: 'Not Found: DELETE /agents' });
  });
});
