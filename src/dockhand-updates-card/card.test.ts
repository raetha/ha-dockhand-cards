import { describe, it, expect } from 'vitest';
import { sortPendingUpdates, shouldShowEnvironmentGroup, type PendingUpdate } from './card';

function update(overrides: Partial<PendingUpdate> & { name: string }): PendingUpdate {
  return {
    entityId: `update.${overrides.name}`,
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

describe('shouldShowEnvironmentGroup', () => {
  it('shows a group with pending updates, regardless of the bulk button', () => {
    expect(shouldShowEnvironmentGroup([update({ name: 'a' })], true)).toBe(true);
    expect(shouldShowEnvironmentGroup([update({ name: 'a' })], false)).toBe(true);
  });

  it('shows a group with a working bulk-update button even when nothing is currently pending — the button should stay discoverable', () => {
    expect(shouldShowEnvironmentGroup([], true)).toBe(true);
  });

  it('hides a group with neither pending updates nor a bulk-update button', () => {
    expect(shouldShowEnvironmentGroup([], false)).toBe(false);
  });
});
