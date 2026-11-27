import type { IncomingMessage, ServerResponse } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { runTool } from '../helpers/tool.helper.ts';
import type { AgentTool } from '../models/runner.model.ts';

/** Answers one MCP request for the agent's tools in the A2A context `contextId`, on Node's own request and response. */
export type ToolsMcpHandler = (contextId: string, req: IncomingMessage, res: ServerResponse) => Promise<void>;

/**
 * The agent's tools over MCP, for a runner whose SDK runs its tools through an MCP server it connects to itself (the
 * Codex CLI). Stateless: every request gets a server and a transport of its own, closed when the response is.
 */
export function toolsMcpHandler(tools: AgentTool[]): ToolsMcpHandler {
  return async (contextId, req, res) => {
    // An MCP server offering the tools, each told the context and the request's abort signal when it runs.
    const server = new McpServer({ name: 'agent-tools', version: '0.1.0' });
    for (const tool of tools) {
      server.registerTool(tool.name, { description: tool.description, inputSchema: tool.input.shape }, async (input, extra) => {
        const result = await runTool(tool, input, { contextId, signal: extra.signal });
        return { content: [{ type: 'text', text: result.text }], ...(result.isError ? { isError: true } : {}) };
      });
    }
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res);
  };
}
