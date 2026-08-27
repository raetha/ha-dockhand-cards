import { describe, it, expect } from 'vitest';
import {
  resolveEnvironmentEntities,
  resolveContainerEntities,
  resolveStackEntities,
  findPrimaryEntityByDomain,
  getContainerDropdownOptions,
  getStackDropdownOptions,
  resolveScheduleEntities
} from './entity-resolver';
import { makeDevice, makeEntity, makeState, makeHass } from './test-fixtures';

const ENV_DEVICE_ID = 'env-device';

describe('resolveEnvironmentEntities', () => {
  it('resolves an enabled entity with a state', () => {
    const entity = makeEntity({ entity_id: 'binary_sensor.online', device_id: ENV_DEVICE_ID, translation_key: 'online' });
    const state = makeState({ entity_id: 'binary_sensor.online', state: 'on' });
    const hass = makeHass({ entities: [entity], states: [state] });

    const result = resolveEnvironmentEntities(hass, ENV_DEVICE_ID, ['online']);
    expect(result.found.online?.entityId).toBe('binary_sensor.online');
    expect(result.unavailable).toEqual([]);
  });

  it('reports a disabled entity distinctly from a missing one', () => {
    const disabled = makeEntity({
      entity_id: 'sensor.cpu',
      device_id: ENV_DEVICE_ID,
      translation_key: 'cpu_usage',
      disabled_by: 'user'
    });
    const hass = makeHass({ entities: [disabled] });

    const result = resolveEnvironmentEntities(hass, ENV_DEVICE_ID, ['cpuUsage', 'memoryUsage']);
    expect(result.unavailable).toContainEqual({ key: 'cpuUsage', entityId: 'sensor.cpu', reason: 'disabled' });
    expect(result.unavailable).toContainEqual({ key: 'memoryUsage', entityId: null, reason: 'not_found' });
    expect(result.found).toEqual({});
  });

  it('treats an enabled entity with no state yet as not_found, not disabled', () => {
    const entity = makeEntity({ entity_id: 'sensor.cpu', device_id: ENV_DEVICE_ID, translation_key: 'cpu_usage' });
    const hass = makeHass({ entities: [entity], states: [] });

    const result = resolveEnvironmentEntities(hass, ENV_DEVICE_ID, ['cpuUsage']);
    expect(result.unavailable).toEqual([{ key: 'cpuUsage', entityId: 'sensor.cpu', reason: 'not_found' }]);
  });

  it('never matches entities belonging to a different device or platform', () => {
    const wrongDevice = makeEntity({ entity_id: 'sensor.a', device_id: 'other-device', translation_key: 'cpu_usage' });
    const wrongPlatform = makeEntity({ entity_id: 'sensor.b', device_id: ENV_DEVICE_ID, translation_key: 'cpu_usage', platform: 'other' });
    const hass = makeHass({
      entities: [wrongDevice, wrongPlatform],
      states: [makeState({ entity_id: 'sensor.a', state: '1' }), makeState({ entity_id: 'sensor.b', state: '2' })]
    });

    const result = resolveEnvironmentEntities(hass, ENV_DEVICE_ID, ['cpuUsage']);
    expect(result.found).toEqual({});
    expect(result.unavailable).toEqual([{ key: 'cpuUsage', entityId: null, reason: 'not_found' }]);
  });
});

// resolveContainerEntities/resolveStackEntities are thin wrappers around
// the same resolveEntities the tests above already exercise thoroughly —
// these confirm each wrapper is actually wired to its own real
// translation-key map (CONTAINER_TRANSLATION_KEYS/STACK_TRANSLATION_KEYS
// in common/const.ts), not a full re-test of shared resolution logic
// that's already covered.
describe('resolveContainerEntities', () => {
  const CONTAINER_DEVICE_ID = 'container-device';

  it('resolves a real container-specific key', () => {
    const entity = makeEntity({ entity_id: 'sensor.cpu', device_id: CONTAINER_DEVICE_ID, translation_key: 'container_cpu_percent' });
    const state = makeState({ entity_id: 'sensor.cpu', state: '12.5' });
    const hass = makeHass({ entities: [entity], states: [state] });

    const result = resolveContainerEntities(hass, CONTAINER_DEVICE_ID, ['cpuPercent']);
    expect(result.found.cpuPercent?.entityId).toBe('sensor.cpu');
  });
});

describe('resolveStackEntities', () => {
  const STACK_DEVICE_ID = 'stack-device';

  it('resolves a real stack-specific key', () => {
    const entity = makeEntity({ entity_id: 'sensor.status', device_id: STACK_DEVICE_ID, translation_key: 'status' });
    const state = makeState({ entity_id: 'sensor.status', state: 'running' });
    const hass = makeHass({ entities: [entity], states: [state] });

    const result = resolveStackEntities(hass, STACK_DEVICE_ID, ['status']);
    expect(result.found.status?.entityId).toBe('sensor.status');
  });

  it('treats a missing git_* key as not_found, not an error — the documented "not git-tracked" signal', () => {
    // git_sync_status only exists on git-tracked stacks at all; a stack
    // that isn't git-tracked simply never gets this entity, and
    // resolveEntities' own not_found handling is what the stack card
    // relies on to distinguish "not git-tracked" from a real problem.
    const hass = makeHass({});
    const result = resolveStackEntities(hass, STACK_DEVICE_ID, ['gitSyncStatus']);
    expect(result.found.gitSyncStatus).toBeUndefined();
    expect(result.unavailable).toEqual([{ key: 'gitSyncStatus', entityId: null, reason: 'not_found' }]);
  });
});

describe('findPrimaryEntityByDomain', () => {
  it('finds the single enabled entity of a domain on a device', () => {
    const entity = makeEntity({ entity_id: 'update.web', device_id: 'c1', translation_key: null });
    const state = makeState({ entity_id: 'update.web', state: 'on' });
    const hass = makeHass({ entities: [entity], states: [state] });

    const result = findPrimaryEntityByDomain(hass, 'c1', 'update');
    expect(result?.entityId).toBe('update.web');
  });

  it('returns null when no entity of that domain exists on the device', () => {
    const hass = makeHass({});
    expect(findPrimaryEntityByDomain(hass, 'c1', 'update')).toBeNull();
  });

  it('ignores a disabled entity of that domain', () => {
    const entity = makeEntity({ entity_id: 'update.web', device_id: 'c1', translation_key: null, disabled_by: 'user' });
    const hass = makeHass({ entities: [entity] });
    expect(findPrimaryEntityByDomain(hass, 'c1', 'update')).toBeNull();
  });

  it('never matches an entity belonging to a different device', () => {
    const entity = makeEntity({ entity_id: 'update.web', device_id: 'other', translation_key: null });
    const state = makeState({ entity_id: 'update.web', state: 'on' });
    const hass = makeHass({ entities: [entity], states: [state] });
    expect(findPrimaryEntityByDomain(hass, 'c1', 'update')).toBeNull();
  });
});

describe('getContainerDropdownOptions', () => {
  it('labels with the raw container name attribute, not the full device display name, sorted alphabetically', () => {
    const zebra = makeDevice({ id: 'c-zebra', name: 'Forseti \u2013 Containers \u2013 zebra' });
    const alpha = makeDevice({ id: 'c-alpha', name: 'Forseti \u2013 Containers \u2013 alpha' });
    const entities = [
      makeEntity({ entity_id: 'sensor.zebra_state', device_id: 'c-zebra', translation_key: 'state' }),
      makeEntity({ entity_id: 'sensor.alpha_state', device_id: 'c-alpha', translation_key: 'state' })
    ];
    const states = [
      makeState({ entity_id: 'sensor.zebra_state', state: 'running', attributes: { name: 'zebra' } }),
      makeState({ entity_id: 'sensor.alpha_state', state: 'running', attributes: { name: 'alpha' } })
    ];
    const hass = makeHass({ devices: [zebra, alpha], entities, states });

    const result = getContainerDropdownOptions(hass, [zebra, alpha]);
    expect(result).toEqual([
      { value: 'c-alpha', label: 'alpha' },
      { value: 'c-zebra', label: 'zebra' }
    ]);
  });

  it('falls back to the device display name when the state entity/attribute is unavailable (pre-1.8.0 ha-dockhand)', () => {
    const device = makeDevice({ id: 'c-old', name: 'Forseti \u2013 Containers \u2013 legacy', name_by_user: null });
    const hass = makeHass({ devices: [device] });

    const result = getContainerDropdownOptions(hass, [device]);
    expect(result).toEqual([{ value: 'c-old', label: 'Forseti \u2013 Containers \u2013 legacy' }]);
  });
});

describe('getStackDropdownOptions', () => {
  it('labels with the raw stack name attribute, not the full device display name, sorted alphabetically', () => {
    const zebra = makeDevice({ id: 's-zebra', name: 'Forseti \u2013 Stacks \u2013 zebra-stack' });
    const alpha = makeDevice({ id: 's-alpha', name: 'Forseti \u2013 Stacks \u2013 alpha-stack' });
    const entities = [
      makeEntity({ entity_id: 'sensor.zebra_status', device_id: 's-zebra', translation_key: 'status' }),
      makeEntity({ entity_id: 'sensor.alpha_status', device_id: 's-alpha', translation_key: 'status' })
    ];
    const states = [
      makeState({ entity_id: 'sensor.zebra_status', state: 'running', attributes: { name: 'zebra-stack' } }),
      makeState({ entity_id: 'sensor.alpha_status', state: 'running', attributes: { name: 'alpha-stack' } })
    ];
    const hass = makeHass({ devices: [zebra, alpha], entities, states });

    const result = getStackDropdownOptions(hass, [zebra, alpha]);
    expect(result).toEqual([
      { value: 's-alpha', label: 'alpha-stack' },
      { value: 's-zebra', label: 'zebra-stack' }
    ]);
  });
});

describe('resolveScheduleEntities', () => {
  it('resolves last_status and next_run by translation_key', () => {
    const deviceId = 'schedule-device';
    const entities = [
      makeEntity({ entity_id: 'sensor.nginx_last_status', device_id: deviceId, translation_key: 'last_status' }),
      makeEntity({ entity_id: 'sensor.nginx_next_run', device_id: deviceId, translation_key: 'next_run' })
    ];
    const states = [
      makeState({ entity_id: 'sensor.nginx_last_status', state: 'success', attributes: { name: 'Update container: nginx' } }),
      makeState({ entity_id: 'sensor.nginx_next_run', state: '2026-08-01T00:00:00Z' })
    ];
    const hass = makeHass({ entities, states });

    const result = resolveScheduleEntities(hass, deviceId, ['lastStatus', 'nextRun']);
    expect(result.found.lastStatus?.entityId).toBe('sensor.nginx_last_status');
    expect(result.found.lastStatus?.state.attributes.name).toBe('Update container: nginx');
    expect(result.found.nextRun?.entityId).toBe('sensor.nginx_next_run');
    expect(result.unavailable).toEqual([]);
  });
});
