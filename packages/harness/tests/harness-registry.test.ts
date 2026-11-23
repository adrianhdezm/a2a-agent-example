import { describe, expect, it } from 'vitest';
import { DuplicateHarnessError } from '../src/errors/duplicate-harness-error.ts';
import { UnknownHarnessError } from '../src/errors/unknown-harness-error.ts';
import { HarnessRegistry } from '../src/harness-registry.ts';
import { FakeHarness } from '../src/testing/fake-harness.ts';

describe('HarnessRegistry', () => {
  it('returns the harness registered under a name', () => {
    const registry = new HarnessRegistry();
    const harness = new FakeHarness('fake', []);

    registry.register(harness);

    expect(registry.get('fake')).toBe(harness);
    expect(registry.has('fake')).toBe(true);
  });

  it('throws an UnknownHarnessError naming a harness that is not registered', () => {
    const registry = new HarnessRegistry();

    expect(() => registry.get('missing')).toThrow(UnknownHarnessError);
    expect(() => registry.get('missing')).toThrow('"missing"');
    expect(registry.has('missing')).toBe(false);
  });

  it('rejects a second harness under a name already taken', () => {
    const registry = new HarnessRegistry();
    registry.register(new FakeHarness('fake', []));

    expect(() => {
      registry.register(new FakeHarness('fake', []));
    }).toThrow(DuplicateHarnessError);
  });
});
