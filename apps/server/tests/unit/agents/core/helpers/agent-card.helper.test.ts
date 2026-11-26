import { describe, expect, it } from 'vitest';
import { jsonRpcInterface } from '../../../../../src/agents/core/helpers/agent-card.helper.ts';

describe('agent-card.helper', () => {
  it('points the JSON-RPC interface at the endpoint under the base URL, on protocol 1.0', () => {
    expect(jsonRpcInterface('http://localhost:41241/')).toEqual({
      url: 'http://localhost:41241/a2a/jsonrpc',
      protocolBinding: 'JSONRPC',
      tenant: '',
      protocolVersion: '1.0'
    });
  });
});
