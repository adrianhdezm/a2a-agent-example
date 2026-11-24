import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';

// Sample messages in the shape the Claude Agent SDK streams for one weather turn, trimmed to the fields the turn
// reads; the casts stand in for the many fields it ignores.

export const sessionId = '6c1c8a52-0b6e-4d55-9a8e-2f0f7c1d9b10';

export const init = { type: 'system', subtype: 'init', session_id: sessionId } as unknown as SDKMessage;

export const toolCall = {
  type: 'assistant',
  session_id: sessionId,
  message: {
    content: [
      { type: 'text', text: "I'll look up Lisbon first." },
      { type: 'tool_use', id: 'toolu_01', name: 'mcp__weather__find_city', input: { name: 'Lisbon' } }
    ]
  }
} as unknown as SDKMessage;

export const answer = {
  type: 'assistant',
  session_id: sessionId,
  message: { content: [{ type: 'text', text: 'Take an umbrella tomorrow.\nCOMPLETED' }] }
} as unknown as SDKMessage;

export const success = {
  type: 'result',
  subtype: 'success',
  session_id: sessionId,
  result: 'Take an umbrella tomorrow: 85% chance of rain.\nCOMPLETED'
} as unknown as SDKMessage;

export const question = {
  type: 'result',
  subtype: 'success',
  session_id: sessionId,
  result: 'Springfield, Illinois or Springfield, Missouri?\nAWAITING_USER_INPUT'
} as unknown as SDKMessage;

export const maxTurns = { type: 'result', subtype: 'error_max_turns', session_id: sessionId, errors: [] } as unknown as SDKMessage;
