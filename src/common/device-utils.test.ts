import { describe, it, expect } from 'vitest';
import { getEnvironmentDevices, isEnvironmentDevice, getEnvId, getContainerDevicesForEnvironment } from './device-utils';
import { makeDevice, makeHass } from './test-fixtures';

describe('isEnvironmentDevice / getEnvironmentDevices', () => {
  it('matches only the bare env_<id> identifier, not group devices', () => {
    const env = makeDevice({ id: 'env-device', identifiers: [['dockhand', 'env_5']], name: 'Homelab' });
    const containersGroup = makeDevice({ id: 'group-device', identifiers: [['dockhand', 'env_5_Containers']], name: 'Homelab – Containers' });
    const otherIntegration = makeDevice({ id: 'other', identifiers: [['not_dockhand', 'env_5']] });

    expect(isEnvironmentDevice(env)).toBe(true);
    expect(isEnvironmentDevice(containersGroup)).toBe(false);
    expect(isEnvironmentDevice(otherIntegration)).toBe(false);

    const hass = makeHass({ devices: [env, containersGroup, otherIntegration] });
    const result = getEnvironmentDevices(hass);
    expect(result).toEqual([{ deviceId: 'env-device', name: 'Homelab' }]);
  });

  it('prefers name_by_user over name, and sorts alphabetically', () => {
    const a = makeDevice({ id: 'a', identifiers: [['dockhand', 'env_1']], name: 'Zebra' });
    const b = makeDevice({ id: 'b', identifiers: [['dockhand', 'env_2']], name: 'Apple', name_by_user: 'Custom Name' });
    const hass = makeHass({ devices: [a, b] });

    const result = getEnvironmentDevices(hass);
    expect(result.map((r) => r.name)).toEqual(['Custom Name', 'Zebra']);
  });

  it('returns an empty list when there are no environment devices', () => {
    expect(getEnvironmentDevices(makeHass({ devices: [] }))).toEqual([]);
  });
});

describe('getEnvId', () => {
  it('extracts the numeric id from env_<id>', () => {
    const env = makeDevice({ id: 'x', identifiers: [['dockhand', 'env_42']] });
    expect(getEnvId(env)).toBe(42);
  });

  it('returns null for a non-environment device', () => {
    const group = makeDevice({ id: 'x', identifiers: [['dockhand', 'env_42_Containers']] });
    expect(getEnvId(group)).toBeNull();
  });
});

describe('getContainerDevicesForEnvironment', () => {
  it('matches container_<envId>_ prefixed identifiers for that env only', () => {
    const c1 = makeDevice({ id: 'c1', identifiers: [['dockhand', 'container_5_web']] });
    const c2 = makeDevice({ id: 'c2', identifiers: [['dockhand', 'container_5_db']] });
    const otherEnv = makeDevice({ id: 'c3', identifiers: [['dockhand', 'container_9_web']] });
    const hass = makeHass({ devices: [c1, c2, otherEnv] });

    const result = getContainerDevicesForEnvironment(hass, 5);
    expect(result.map((d) => d.id).sort()).toEqual(['c1', 'c2']);
  });
});

