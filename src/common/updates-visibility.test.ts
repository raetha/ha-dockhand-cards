import { describe, it, expect } from 'vitest';
import { getPendingUpdatesEntityId, hasPendingUpdates, buildUpdatesVisibilityCondition } from './updates-visibility';
import { makeEntity, makeState, makeHass } from './test-fixtures';

const ENV_A = 'env-a';
const ENV_B = 'env-b';

// These tests are about the aggregate lookup and the visibility condition;
// which containers count is ha-dockhand's Pending updates sensor's business.
function hassWithPendingUpdates(deviceId: string, entityId: string, count: number | undefined) {
  const entity = makeEntity({ entity_id: entityId, device_id: deviceId, translation_key: 'pending_updates' });
  const state = makeState({ entity_id: entityId, state: count === undefined ? 'unknown' : String(count) });
  return makeHass({ entities: [entity], states: [state] });
}

describe('getPendingUpdatesEntityId', () => {
  it('resolves the Pending updates sensor for a device', () => {
    const hass = hassWithPendingUpdates(ENV_A, 'sensor.nebula_pending_updates', 0);
    expect(getPendingUpdatesEntityId(hass, ENV_A)).toBe('sensor.nebula_pending_updates');
  });

  it('returns undefined when the device has no Pending updates sensor', () => {
    const hass = makeHass({});
    expect(getPendingUpdatesEntityId(hass, ENV_A)).toBeUndefined();
  });
});

describe('hasPendingUpdates', () => {
  it('is true when the pending count is above zero', () => {
    const hass = hassWithPendingUpdates(ENV_A, 'sensor.nebula_pending_updates', 3);
    expect(hasPendingUpdates(hass, ENV_A)).toBe(true);
  });

  it('is false when the pending count is exactly zero', () => {
    const hass = hassWithPendingUpdates(ENV_A, 'sensor.nebula_pending_updates', 0);
    expect(hasPendingUpdates(hass, ENV_A)).toBe(false);
  });

  it('defaults to true (not hidden) rather than hiding on missing/unresolved data', () => {
    const hass = makeHass({});
    expect(hasPendingUpdates(hass, ENV_A)).toBe(true);
  });

  it('defaults to true when the entity exists but its state is not a number', () => {
    const hass = hassWithPendingUpdates(ENV_A, 'sensor.nebula_pending_updates', undefined);
    expect(hasPendingUpdates(hass, ENV_A)).toBe(true);
  });
});

describe('buildUpdatesVisibilityCondition', () => {
  it('builds a single numeric_state condition for one environment', () => {
    const hass = hassWithPendingUpdates(ENV_A, 'sensor.nebula_pending_updates', 0);
    const result = buildUpdatesVisibilityCondition(hass, [ENV_A]);
    expect(result).toEqual([{ condition: 'numeric_state', entity: 'sensor.nebula_pending_updates', above: 0 }]);
  });

  it('OR-combines conditions across multiple environments', () => {
    const entityA = makeEntity({ entity_id: 'sensor.a_pending_updates', device_id: ENV_A, translation_key: 'pending_updates' });
    const entityB = makeEntity({ entity_id: 'sensor.b_pending_updates', device_id: ENV_B, translation_key: 'pending_updates' });
    const hass = makeHass({
      entities: [entityA, entityB],
      states: [makeState({ entity_id: 'sensor.a_pending_updates', state: '1' }), makeState({ entity_id: 'sensor.b_pending_updates', state: '2' })]
    });
    const result = buildUpdatesVisibilityCondition(hass, [ENV_A, ENV_B]);
    expect(result).toEqual([
      {
        condition: 'or',
        conditions: [
          { condition: 'numeric_state', entity: 'sensor.a_pending_updates', above: 0 },
          { condition: 'numeric_state', entity: 'sensor.b_pending_updates', above: 0 }
        ]
      }
    ]);
  });

  it('returns undefined when no device resolves to a usable entity', () => {
    const hass = makeHass({});
    expect(buildUpdatesVisibilityCondition(hass, [ENV_A])).toBeUndefined();
  });

  it('skips devices that do not resolve, still building conditions for the ones that do', () => {
    const hass = hassWithPendingUpdates(ENV_A, 'sensor.nebula_pending_updates', 0);
    const result = buildUpdatesVisibilityCondition(hass, [ENV_A, ENV_B]);
    expect(result).toEqual([{ condition: 'numeric_state', entity: 'sensor.nebula_pending_updates', above: 0 }]);
  });
});
