import { describe, it, expect } from 'vitest';
import { sortPendingUpdates, type PendingUpdate } from './card';

function update(overrides: Partial<PendingUpdate> & { name: string }): PendingUpdate {
  return {
    entityId: `update.${overrides.name}`,
    deviceId: `device-${overrides.name}`,
    kind: 'installable',
    ...overrides
  };
}

describe('sortPendingUpdates', () => {
  it('sorts alphabetically by name', () => {
    const updates = [update({ name: 'zebra' }), update({ name: 'alpha' }), update({ name: 'mango' })];
    expect(sortPendingUpdates(updates).map((u) => u.name)).toEqual(['alpha', 'mango', 'zebra']);
  });

  it('does not mutate the array it was given', () => {
    const updates = [update({ name: 'zebra' }), update({ name: 'alpha' })];
    const original = [...updates];
    sortPendingUpdates(updates);
    expect(updates).toEqual(original);
  });

  it('returns an empty array unchanged', () => {
    expect(sortPendingUpdates([])).toEqual([]);
  });
});
