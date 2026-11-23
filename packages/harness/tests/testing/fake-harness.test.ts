import { describe, expect, it } from 'vitest';
import type { HarnessEvent } from '../../src/harness-event.ts';
import { FakeHarness } from '../../src/testing/fake-harness.ts';

const events: HarnessEvent[] = [
  { type: 'agent.message', text: 'working on it' },
  { type: 'turn.ended', outcome: 'completed', finalText: 'done' }
];
const config = { workspace: '/tmp/agent', instructions: 'Be brief.' };

async function collect(iterable: AsyncIterable<HarnessEvent>): Promise<HarnessEvent[]> {
  const collected: HarnessEvent[] = [];
  for await (const event of iterable) {
    collected.push(event);
  }
  return collected;
}

describe('FakeHarness', () => {
  it('yields the scripted events for each turn and records the input', async () => {
    const harness = new FakeHarness('fake', events);
    const session = harness.startSession(config);

    const yielded = await collect(session.runTurn('hello'));

    expect(yielded).toEqual(events);
    expect(session.inputs).toEqual(['hello']);
    expect(harness.started).toEqual([config]);
  });

  it('gives a new session its id only after the first turn', async () => {
    const session = new FakeHarness('fake', events).startSession(config);
    expect(session.id).toBeUndefined();

    await collect(session.runTurn('hello'));

    expect(session.id).toBe('fake-session-1');
  });

  it('resumes a session under the id it was given and records the resume', () => {
    const harness = new FakeHarness('fake', events);

    const session = harness.resumeSession('fake-session-7', config);

    expect(session.id).toBe('fake-session-7');
    expect(harness.resumed).toEqual([{ id: 'fake-session-7', config }]);
  });
});
