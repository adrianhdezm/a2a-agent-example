import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';

// Sample messages in the shape the Claude Agent SDK streams for one turn, trimmed to the fields the driver reads plus
// the identifying ones; the casts stand in for the many fields the driver ignores.

export const sessionId = '6c1c8a52-0b6e-4d55-9a8e-2f0f7c1d9b10';

export const initMessage = {
  type: 'system',
  subtype: 'init',
  session_id: sessionId,
  uuid: '1f0d3c2e-0000-4000-8000-000000000001',
  cwd: '/srv/workspaces/claude-coder',
  model: 'claude-sonnet-5-5',
  tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep'],
  permissionMode: 'acceptEdits'
} as unknown as SDKMessage;

export const assistantMessage = {
  type: 'assistant',
  session_id: sessionId,
  uuid: '1f0d3c2e-0000-4000-8000-000000000002',
  parent_tool_use_id: null,
  message: {
    id: 'msg_01',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-5-5',
    content: [
      { type: 'text', text: "I'll create hello.py." },
      { type: 'tool_use', id: 'toolu_01', name: 'Write', input: { file_path: 'hello.py', content: "print('Hello, A2A!')\n" } },
      { type: 'text', text: 'Done.' }
    ],
    stop_reason: 'tool_use'
  }
} as unknown as SDKMessage;

export const successResult = {
  type: 'result',
  subtype: 'success',
  session_id: sessionId,
  uuid: '1f0d3c2e-0000-4000-8000-000000000003',
  is_error: false,
  num_turns: 2,
  result: "Created hello.py, which prints 'Hello, A2A!'."
} as unknown as SDKMessage;

export const maxTurnsResult = {
  type: 'result',
  subtype: 'error_max_turns',
  session_id: sessionId,
  uuid: '1f0d3c2e-0000-4000-8000-000000000004',
  is_error: true,
  num_turns: 25,
  errors: []
} as unknown as SDKMessage;

export const executionErrorResult = {
  type: 'result',
  subtype: 'error_during_execution',
  session_id: sessionId,
  uuid: '1f0d3c2e-0000-4000-8000-000000000005',
  is_error: true,
  num_turns: 1,
  errors: ['API Error: 401 invalid x-api-key']
} as unknown as SDKMessage;
