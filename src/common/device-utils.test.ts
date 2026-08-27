import { describe, it, expect } from 'vitest';
import {
  getEnvironmentDevices,
  isEnvironmentDevice,
  getEnvId,
  getContainerDevicesForEnvironment,
  isScheduleDevice,
  getAllScheduleDevices,
  getScheduleHubDevice,
  getScheduleGroupDeviceForEnvironment,
  getScheduleDevicesForEnvironment,
  getGlobalScheduleDevices,
  getEnvIdForScheduleDevice
} from './device-utils';
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

describe('schedule device resolution', () => {
  it('isScheduleDevice / getAllScheduleDevices match schedule_ identifiers only', () => {
    const sched = makeDevice({ id: 's1', identifiers: [['dockhand', 'schedule_5_container_update']] });
    const notSched = makeDevice({ id: 'n1', identifiers: [['dockhand', 'env_5_Schedules']] });
    expect(isScheduleDevice(sched)).toBe(true);
    expect(isScheduleDevice(notSched)).toBe(false);

    const hass = makeHass({ devices: [sched, notSched] });
    expect(getAllScheduleDevices(hass).map((d) => d.id)).toEqual(['s1']);
  });

  it('getScheduleHubDevice finds the flat hub by identifier', () => {
    const hub = makeDevice({ id: 'hub', identifiers: [['dockhand', 'schedules_hub']] });
    const hass = makeHass({ devices: [hub] });
    expect(getScheduleHubDevice(hass)?.id).toBe('hub');
    expect(getScheduleHubDevice(makeHass({ devices: [] }))).toBeNull();
  });

  it('getScheduleGroupDeviceForEnvironment finds env_<id>_Schedules', () => {
    const group = makeDevice({ id: 'g1', identifiers: [['dockhand', 'env_5_Schedules']] });
    const hass = makeHass({ devices: [group] });
    expect(getScheduleGroupDeviceForEnvironment(hass, 5)?.id).toBe('g1');
    expect(getScheduleGroupDeviceForEnvironment(hass, 9)).toBeNull();
  });

  it('getScheduleDevicesForEnvironment resolves via via_device_id, not the schedule identifier', () => {
    const group5 = makeDevice({ id: 'group5', identifiers: [['dockhand', 'env_5_Schedules']] });
    const hub = makeDevice({ id: 'hub', identifiers: [['dockhand', 'schedules_hub']] });
    const s1 = makeDevice({ id: 's1', identifiers: [['dockhand', 'schedule_1_container_update']], via_device_id: 'group5' });
    const s2 = makeDevice({ id: 's2', identifiers: [['dockhand', 'schedule_2_system_cleanup']], via_device_id: 'hub' });
    const hass = makeHass({ devices: [group5, hub, s1, s2] });

    expect(getScheduleDevicesForEnvironment(hass, 5).map((d) => d.id)).toEqual(['s1']);
    expect(getScheduleDevicesForEnvironment(hass, 9)).toEqual([]);
  });

  it('getGlobalScheduleDevices resolves schedules parented to schedules_hub only', () => {
    const group5 = makeDevice({ id: 'group5', identifiers: [['dockhand', 'env_5_Schedules']] });
    const hub = makeDevice({ id: 'hub', identifiers: [['dockhand', 'schedules_hub']] });
    const s1 = makeDevice({ id: 's1', identifiers: [['dockhand', 'schedule_1_container_update']], via_device_id: 'group5' });
    const s2 = makeDevice({ id: 's2', identifiers: [['dockhand', 'schedule_2_system_cleanup']], via_device_id: 'hub' });
    const hass = makeHass({ devices: [group5, hub, s1, s2] });

    expect(getGlobalScheduleDevices(hass).map((d) => d.id)).toEqual(['s2']);
    expect(getGlobalScheduleDevices(makeHass({ devices: [s1, s2] }))).toEqual([]);
  });

  it('getEnvIdForScheduleDevice resolves via via_device_id, returning null for global schedules', () => {
    const group5 = makeDevice({ id: 'group5', identifiers: [['dockhand', 'env_5_Schedules']] });
    const hub = makeDevice({ id: 'hub', identifiers: [['dockhand', 'schedules_hub']] });
    const s1 = makeDevice({ id: 's1', identifiers: [['dockhand', 'schedule_1_container_update']], via_device_id: 'group5' });
    const s2 = makeDevice({ id: 's2', identifiers: [['dockhand', 'schedule_2_system_cleanup']], via_device_id: 'hub' });
    const orphan = makeDevice({ id: 's3', identifiers: [['dockhand', 'schedule_3_image_prune']], via_device_id: null });
    const hass = makeHass({ devices: [group5, hub, s1, s2, orphan] });

    expect(getEnvIdForScheduleDevice(hass, s1)).toBe(5);
    expect(getEnvIdForScheduleDevice(hass, s2)).toBeNull();
    expect(getEnvIdForScheduleDevice(hass, orphan)).toBeNull();
  });
});

