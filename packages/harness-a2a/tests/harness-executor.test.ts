import { TaskState } from '@a2a-js/sdk';
import type { TaskStatus } from '@a2a-js/sdk';
import type { AgentExecutionEvent } from '@a2a-js/sdk/server';
import type { HarnessEvent } from '@a2a-agent-example/harness-core';
import { FakeHarness } from '@a2a-agent-example/harness-core/testing';
import { describe, expect, it } from 'vitest';
import { HarnessExecutor } from '../src/harness-executor.ts';
import { fakeEventBus } from './utils/fake-event-bus.ts';
import { requestContext } from './utils/request-context-seed.ts';

const sessionConfig = { workspace: '/srv/workspaces/claude-coder', instructions: 'You write small programs.' };

const completedTurn: HarnessEvent[] = [
  { type: 'agent.message', text: 'Writing hello.py' },
  { type: 'turn.ended', outcome: 'completed', finalText: 'Created hello.py' }
];

function stateName(status: TaskStatus | undefined): string {
  return TaskState[status?.state ?? TaskState.TASK_STATE_UNSPECIFIED];
}

/** Each published event as its kind and, for a task or a status update, its state; for an artifact, its name. */
function timeline(events: AgentExecutionEvent[]): string[] {
  return events.map((event) => {
    if (event.kind === 'artifactUpdate') {
      return `artifact ${event.data.artifact?.name ?? ''}`;
    }
    if (event.kind === 'message') {
      return 'message';
    }
    return `${event.kind === 'task' ? 'task' : 'status'} ${stateName(event.data.status)}`;
  });
}

function artifactText(events: AgentExecutionEvent[]): string | undefined {
  const artifact = events.find((event) => event.kind === 'artifactUpdate');
  const content = artifact?.kind === 'artifactUpdate' ? artifact.data.artifact?.parts[0]?.content : undefined;
  return content?.$case === 'text' ? content.value : undefined;
}

describe('HarnessExecutor', () => {
  it('publishes submitted, working, the result artifact and completed for a completed turn', async () => {
    // Arrange
    const harness = new FakeHarness('fake', completedTurn);
    const executor = new HarnessExecutor({ harness, sessionConfig, sessions: new Map() });
    const { bus, events, finishedCalls } = fakeEventBus();

    // Act
    await executor.execute(requestContext('Write hello.py', { taskId: 'task-1', contextId: 'context-1' }), bus);

    // Assert
    expect(timeline(events)).toEqual([
      'task TASK_STATE_SUBMITTED',
      'status TASK_STATE_WORKING',
      'status TASK_STATE_WORKING',
      'artifact result',
      'status TASK_STATE_COMPLETED'
    ]);
    expect(artifactText(events)).toBe('Created hello.py');
    expect(finishedCalls()).toBe(1);
  });

  it('runs the turn with the text of the user message in the agent workspace', async () => {
    const harness = new FakeHarness('fake', completedTurn);
    const executor = new HarnessExecutor({ harness, sessionConfig, sessions: new Map() });

    await executor.execute(requestContext('Write hello.py', { taskId: 'task-1', contextId: 'context-1' }), fakeEventBus().bus);

    expect(harness.started).toEqual([sessionConfig]);
    expect(harness.sessions[0]?.inputs).toEqual(['Write hello.py']);
  });

  it('carries each agent message on a working status update', async () => {
    const executor = new HarnessExecutor({
      harness: new FakeHarness('fake', completedTurn),
      sessionConfig,
      sessions: new Map()
    });
    const { bus, events } = fakeEventBus();

    await executor.execute(requestContext('Write hello.py', { taskId: 'task-1', contextId: 'context-1' }), bus);

    const update = events[2];
    const content = update?.kind === 'statusUpdate' ? update.data.status?.message?.parts[0]?.content : undefined;
    expect(content).toEqual({ $case: 'text', value: 'Writing hello.py' });
  });

  it('ends the task failed, with the error as the artifact, for a failed turn', async () => {
    const harness = new FakeHarness('fake', [{ type: 'turn.ended', outcome: 'failed', error: 'invalid x-api-key' }]);
    const executor = new HarnessExecutor({ harness, sessionConfig, sessions: new Map() });
    const { bus, events, finishedCalls } = fakeEventBus();

    await executor.execute(requestContext('Write hello.py', { taskId: 'task-1', contextId: 'context-1' }), bus);

    expect(timeline(events).slice(-2)).toEqual(['artifact result', 'status TASK_STATE_FAILED']);
    expect(artifactText(events)).toBe('invalid x-api-key');
    expect(finishedCalls()).toBe(1);
  });

  it('falls back to the agent messages when the turn reports no final text', async () => {
    const harness = new FakeHarness('fake', [
      { type: 'agent.message', text: 'First' },
      { type: 'agent.message', text: 'Second' },
      { type: 'turn.ended', outcome: 'completed' }
    ]);
    const executor = new HarnessExecutor({ harness, sessionConfig, sessions: new Map() });
    const { bus, events } = fakeEventBus();

    await executor.execute(requestContext('Write hello.py', { taskId: 'task-1', contextId: 'context-1' }), bus);

    expect(artifactText(events)).toBe('First\n\nSecond');
  });

  it('resumes the same harness session for a second message in the same context', async () => {
    // Arrange
    const harness = new FakeHarness('fake', completedTurn);
    const sessions = new Map<string, string>();
    const executor = new HarnessExecutor({ harness, sessionConfig, sessions });

    // Act
    await executor.execute(requestContext('Write hello.py', { taskId: 'task-1', contextId: 'context-1' }), fakeEventBus().bus);
    await executor.execute(requestContext('Now add a test', { taskId: 'task-2', contextId: 'context-1' }), fakeEventBus().bus);

    // Assert
    expect(harness.started).toHaveLength(1);
    expect(harness.resumed.map(({ id }) => id)).toEqual(['fake-session-1']);
    expect(sessions.get('context-1')).toBe('fake-session-1');
  });

  it('starts a separate session for another context', async () => {
    const harness = new FakeHarness('fake', completedTurn);
    const executor = new HarnessExecutor({ harness, sessionConfig, sessions: new Map() });

    await executor.execute(requestContext('Write hello.py', { taskId: 'task-1', contextId: 'context-1' }), fakeEventBus().bus);
    await executor.execute(requestContext('Write hello.py', { taskId: 'task-2', contextId: 'context-2' }), fakeEventBus().bus);

    expect(harness.started).toHaveLength(2);
    expect(harness.resumed).toEqual([]);
  });

  it('reports how each turn ends on the logger it is given', async () => {
    // Arrange
    const reported: { level: string; fields: Record<string, unknown>; message: string }[] = [];
    const record = (level: string) => (fields: Record<string, unknown>, message: string) => {
      reported.push({ level, fields, message });
    };
    const logger = { info: record('info'), warn: record('warn'), error: record('error') };
    const failing = new FakeHarness('fake', [{ type: 'turn.ended', outcome: 'failed', error: 'invalid x-api-key' }]);

    // Act
    await new HarnessExecutor({ harness: new FakeHarness('fake', completedTurn), sessionConfig, sessions: new Map(), logger }).execute(
      requestContext('Write hello.py', { taskId: 'task-1', contextId: 'context-1' }),
      fakeEventBus().bus
    );
    await new HarnessExecutor({ harness: failing, sessionConfig, sessions: new Map(), logger }).execute(
      requestContext('Write hello.py', { taskId: 'task-2', contextId: 'context-2' }),
      fakeEventBus().bus
    );

    // Assert
    expect(reported).toEqual([
      { level: 'info', fields: { taskId: 'task-1', contextId: 'context-1', state: 'TASK_STATE_COMPLETED' }, message: 'turn ended' },
      {
        level: 'warn',
        fields: { taskId: 'task-2', contextId: 'context-2', state: 'TASK_STATE_FAILED', error: 'invalid x-api-key' },
        message: 'turn failed'
      }
    ]);
  });
});
