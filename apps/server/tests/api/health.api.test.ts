import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { serveTestApp } from '../utils/test-app.ts';
import type { TestApp } from '../utils/test-app.ts';

describe('GET /health', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await serveTestApp([[]]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers ok with the current time', async () => {
    const response = await fetch(`${app.baseUrl}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok', timestamp: expect.any(String) as unknown });
  });
});
