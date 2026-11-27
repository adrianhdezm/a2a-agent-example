import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { serveTestApp } from '../utils/test-app.ts';
import type { TestApp } from '../utils/test-app.ts';

async function mcpClient(url: string): Promise<Client> {
  const client = new Client({ name: 'api-test', version: '0.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(url)));
  return client;
}

describe('POST /agents/<id>/mcp/<contextId>', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await serveTestApp([[]]);
  });

  afterAll(async () => {
    await app.close();
  });

  it("lists the agent's own tools, as a runner that reaches tools over MCP sees them", async () => {
    const client = await mcpClient(`${app.baseUrl}/agents/weather/mcp/context-1`);

    const { tools } = await client.listTools();
    await client.close();

    expect(tools.map(({ name }) => name)).toEqual(['find_city', 'get_forecast']);
    expect(tools[0]?.inputSchema).toMatchObject({ type: 'object', properties: { name: { type: 'string' } }, required: ['name'] });
  });

  it('calls a tool and answers with its result, a tool error as an error the model can explain', async () => {
    const client = await mcpClient(`${app.baseUrl}/agents/weather/mcp/context-1`);

    const result = await client.callTool({ name: 'find_city', arguments: { name: 'Lisbon' } });
    await client.close();

    // Open-Meteo is not reached in the API tests: the fake fetch fails, and the client reports it as Open-Meteo's error.
    expect(result).toMatchObject({ isError: true, content: [{ type: 'text', text: expect.stringContaining('Open-Meteo') as unknown }] });
  });
});
