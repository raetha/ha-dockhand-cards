import { describe, it, expect } from 'vitest';
import { resolveEnvironmentEntities, resolveTopContainers, findPrimaryEntityByDomain, getContainerDropdownOptions, getStackDropdownOptions } from './entity-resolver';
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

describe('resolveTopContainers', () => {
  it('skips containers with neither CPU nor memory sensor enabled', () => {
    const noSensors = makeDevice({ id: 'c1', identifiers: [['dockhand', 'container_5_quiet']], name: 'quiet' });
    const hass = makeHass({ devices: [noSensors] });

    expect(resolveTopContainers(hass, 5)).toEqual([]);
  });

  it('ranks by CPU descending and caps at the limit', () => {
    const devices = ['a', 'b', 'c'].map((n) => makeDevice({ id: n, identifiers: [['dockhand', `container_5_${n}`]], name: n }));
    const entities = [
      makeEntity({ entity_id: 'sensor.a_cpu', device_id: 'a', translation_key: 'container_cpu_percent' }),
      makeEntity({ entity_id: 'sensor.b_cpu', device_id: 'b', translation_key: 'container_cpu_percent' }),
      makeEntity({ entity_id: 'sensor.c_cpu', device_id: 'c', translation_key: 'container_cpu_percent' })
    ];
    const states = [
      makeState({ entity_id: 'sensor.a_cpu', state: '10' }),
      makeState({ entity_id: 'sensor.b_cpu', state: '90' }),
      makeState({ entity_id: 'sensor.c_cpu', state: '50' })
    ];
    const hass = makeHass({ devices, entities, states });

    const result = resolveTopContainers(hass, 5, 2);
    expect(result.map((r) => r.name)).toEqual(['b', 'c']);
    expect(result[0].cpuPercent).toBe(90);
  });

  it('shows a container with only memory enabled using a null (not zero) CPU', () => {
    const device = makeDevice({ id: 'mem-only', identifiers: [['dockhand', 'container_5_mem-only']], name: 'mem-only' });
    const entity = makeEntity({ entity_id: 'sensor.mem', device_id: 'mem-only', translation_key: 'container_memory_percent' });
    const state = makeState({ entity_id: 'sensor.mem', state: '42' });
    const hass = makeHass({ devices: [device], entities: [entity], states: [state] });

    const result = resolveTopContainers(hass, 5);
    expect(result).toHaveLength(1);
    expect(result[0].cpuPercent).toBeNull();
    expect(result[0].memoryPercent).toBe(42);
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
