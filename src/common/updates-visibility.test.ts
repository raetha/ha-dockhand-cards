import { describe, it, expect } from 'vitest';
import { getPendingUpdatesEntityId, hasPendingUpdates, buildUpdatesVisibilityCondition } from './updates-visibility';
import { makeEntity, makeState, makeHass } from './test-fixtures';

const ENV_A = 'env-a';
const ENV_B = 'env-b';

// pending_updates_total is ha-dockhand's own corrected, system-container-
// inclusive total as of 1.8.2 (see that repo's sensor.py comment on
// DockhandEnvContainerCountSensor for the full three-attribute design:
// pending_updates is bulk-eligible only, pending_system_updates is
// system-only, pending_updates_total is the sum this repo actually reads
// for visibility purposes) — this repo just reads whatever value the
// entity reports, so these tests are about the aggregate-lookup and
// visibility-condition-building logic, not about system-container
// correctness itself, which lives entirely on the ha-dockhand side now.
// A per-container-entity approach was tried here first and reverted: it
// baked individual container update entity ids into saved `visibility:`
// config, which went stale the moment a container was added, removed, or
// recreated, and produced a 50+-condition array for a real environment
// with that many containers — see docs/ARCHITECTURE.md.
function hassWithPendingUpdates(deviceId: string, entityId: string, count: number | undefined) {
  const entity = makeEntity({ entity_id: entityId, device_id: deviceId, translation_key: 'containers' });
  const state = makeState({
    entity_id: entityId,
    state: '5',
    attributes: count === undefined ? {} : { pending_updates_total: count }
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
  it('is true when pending_updates_total is above zero', () => {
    const hass = hassWithPendingUpdates(ENV_A, 'sensor.nebula_containers', 3);
    expect(hasPendingUpdates(hass, ENV_A)).toBe(true);
  });

  it('is false when pending_updates_total is exactly zero', () => {
    const hass = hassWithPendingUpdates(ENV_A, 'sensor.nebula_containers', 0);
    expect(hasPendingUpdates(hass, ENV_A)).toBe(false);
  });

  it('defaults to true (not hidden) rather than hiding on missing/unresolved data', () => {
    const hass = makeHass({});
    expect(hasPendingUpdates(hass, ENV_A)).toBe(true);
  });

  it('defaults to true when the entity exists but pending_updates_total attribute is absent', () => {
    const hass = hassWithPendingUpdates(ENV_A, 'sensor.nebula_containers', undefined);
    expect(hasPendingUpdates(hass, ENV_A)).toBe(true);
  });
});

describe('buildUpdatesVisibilityCondition', () => {
  it('builds a single numeric_state condition for one environment', () => {
    const hass = hassWithPendingUpdates(ENV_A, 'sensor.nebula_containers', 0);
    const result = buildUpdatesVisibilityCondition(hass, [ENV_A]);
    expect(result).toEqual([{ condition: 'numeric_state', entity: 'sensor.nebula_containers', attribute: 'pending_updates_total', above: 0 }]);
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
          { condition: 'numeric_state', entity: 'sensor.a_containers', attribute: 'pending_updates_total', above: 0 },
          { condition: 'numeric_state', entity: 'sensor.b_containers', attribute: 'pending_updates_total', above: 0 }
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
    expect(result).toEqual([{ condition: 'numeric_state', entity: 'sensor.nebula_containers', attribute: 'pending_updates_total', above: 0 }]);
  });
});
