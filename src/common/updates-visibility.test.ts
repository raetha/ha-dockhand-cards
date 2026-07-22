import { describe, it, expect } from 'vitest';
import { getPendingUpdatesEntityId, hasPendingUpdates, buildUpdatesVisibilityCondition } from './updates-visibility';
import { makeEntity, makeState, makeHass } from './test-fixtures';

const ENV_A = 'env-a';
const ENV_B = 'env-b';

function hassWithPendingUpdates(deviceId: string, entityId: string, count: number | undefined) {
  const entity = makeEntity({ entity_id: entityId, device_id: deviceId, translation_key: 'containers' });
  const state = makeState({
    entity_id: entityId,
    state: '5',
    attributes: count === undefined ? {} : { pending_updates: count }
  });
  return makeHass({ entities: [entity], states: [state] });
}

describe('getPendingUpdatesEntityId', () => {
  it('resolves the containers entity for a device', () => {
    const hass = hassWithPendingUpdates(ENV_A, 'sensor.nebula_containers', 0);
    expect(getPendingUpdatesEntityId(hass, ENV_A)).toBe('sensor.nebula_containers');
  });

  it('returns undefined when the device has no containers entity', () => {
    const hass = makeHass({});
    expect(getPendingUpdatesEntityId(hass, ENV_A)).toBeUndefined();
  });
});

describe('hasPendingUpdates', () => {
  it('is true when pending_updates is above zero', () => {
    const hass = hassWithPendingUpdates(ENV_A, 'sensor.nebula_containers', 3);
    expect(hasPendingUpdates(hass, ENV_A)).toBe(true);
  });

  it('is false when pending_updates is exactly zero', () => {
    const hass = hassWithPendingUpdates(ENV_A, 'sensor.nebula_containers', 0);
    expect(hasPendingUpdates(hass, ENV_A)).toBe(false);
  });

  it('defaults to true (not hidden) rather than hiding on missing/unresolved data', () => {
    const hass = makeHass({});
    expect(hasPendingUpdates(hass, ENV_A)).toBe(true);
  });

  it('defaults to true when the entity exists but pending_updates attribute is absent', () => {
    const hass = hassWithPendingUpdates(ENV_A, 'sensor.nebula_containers', undefined);
    expect(hasPendingUpdates(hass, ENV_A)).toBe(true);
  });
});

describe('buildUpdatesVisibilityCondition', () => {
  it('builds a single numeric_state condition for one environment', () => {
    const hass = hassWithPendingUpdates(ENV_A, 'sensor.nebula_containers', 0);
    const result = buildUpdatesVisibilityCondition(hass, [ENV_A]);
    expect(result).toEqual([{ condition: 'numeric_state', entity: 'sensor.nebula_containers', attribute: 'pending_updates', above: 0 }]);
  });

  it('OR-combines conditions across multiple environments', () => {
    const entityA = makeEntity({ entity_id: 'sensor.a_containers', device_id: ENV_A, translation_key: 'containers' });
    const entityB = makeEntity({ entity_id: 'sensor.b_containers', device_id: ENV_B, translation_key: 'containers' });
    const hass = makeHass({
      entities: [entityA, entityB],
      states: [makeState({ entity_id: 'sensor.a_containers', state: '1' }), makeState({ entity_id: 'sensor.b_containers', state: '2' })]
    });
    const result = buildUpdatesVisibilityCondition(hass, [ENV_A, ENV_B]);
    expect(result).toEqual([
      {
        condition: 'or',
        conditions: [
          { condition: 'numeric_state', entity: 'sensor.a_containers', attribute: 'pending_updates', above: 0 },
          { condition: 'numeric_state', entity: 'sensor.b_containers', attribute: 'pending_updates', above: 0 }
        ]
      }
    ]);
  });

  it('returns undefined when no device resolves to a usable entity', () => {
    const hass = makeHass({});
    expect(buildUpdatesVisibilityCondition(hass, [ENV_A])).toBeUndefined();
  });

  it('skips devices that do not resolve, still building conditions for the ones that do', () => {
    const hass = hassWithPendingUpdates(ENV_A, 'sensor.nebula_containers', 0);
    const result = buildUpdatesVisibilityCondition(hass, [ENV_A, ENV_B]);
    expect(result).toEqual([{ condition: 'numeric_state', entity: 'sensor.nebula_containers', attribute: 'pending_updates', above: 0 }]);
  });
});
