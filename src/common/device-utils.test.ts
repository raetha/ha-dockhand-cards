import { describe, it, expect } from 'vitest';
import {
  getEnvironmentDevices,
  isEnvironmentDevice,
  getEnvId,
  getContainerDevicesForEnvironment,
  getStackDevicesForEnvironment,
  getEnvIdForContainerDevice,
  getEnvIdForStackDevice,
  getEnvDeviceForEnvId,
  getEnvDeviceIdForEnvId,
  isScheduleDevice,
  getAllScheduleDevices,
  getScheduleHubDevices,
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
    const env = makeDevice({ id: 'env1', identifiers: [['dockhand', 'entryA_env_5']], config_entries: ['entryA'] });
    const c1 = makeDevice({ id: 'c1', identifiers: [['dockhand', 'entryA_container_5_web']], config_entries: ['entryA'] });
    const c2 = makeDevice({ id: 'c2', identifiers: [['dockhand', 'entryA_container_5_db']], config_entries: ['entryA'] });
    const otherEnv = makeDevice({ id: 'c3', identifiers: [['dockhand', 'entryA_container_9_web']], config_entries: ['entryA'] });
    const hass = makeHass({ devices: [env, c1, c2, otherEnv] });

    const result = getContainerDevicesForEnvironment(hass, env);
    expect(result.map((d) => d.id).sort()).toEqual(['c1', 'c2']);
  });

  it('does not merge two config entries whose environments share the same numeric env_id', () => {
    // Every Dockhand instance numbers its own first environment 1 — this is
    // the real-world shape reported in ha-dockhand-cards#1: two separate
    // hubs (different config entries) each with an "env_1", each with
    // their own containers, must never bleed into each other just because
    // the trailing number matches.
    const env1 = makeDevice({ id: 'env1', identifiers: [['dockhand', 'entryA_env_1']], config_entries: ['entryA'] });
    const env2 = makeDevice({ id: 'env2', identifiers: [['dockhand', 'entryB_env_1']], config_entries: ['entryB'] });
    const c1 = makeDevice({ id: 'c1', identifiers: [['dockhand', 'entryA_container_1_web']], config_entries: ['entryA'] });
    const c2 = makeDevice({ id: 'c2', identifiers: [['dockhand', 'entryB_container_1_web']], config_entries: ['entryB'] });
    const hass = makeHass({ devices: [env1, env2, c1, c2] });

    expect(getContainerDevicesForEnvironment(hass, env1).map((d) => d.id)).toEqual(['c1']);
    expect(getContainerDevicesForEnvironment(hass, env2).map((d) => d.id)).toEqual(['c2']);
  });

  it('still matches pre-1.9.0 bare identifiers when both env and container predate entry_id-prefixing', () => {
    const env = makeDevice({ id: 'env1', identifiers: [['dockhand', 'env_5']], config_entries: ['entryA'] });
    const c1 = makeDevice({ id: 'c1', identifiers: [['dockhand', 'container_5_web']], config_entries: ['entryA'] });
    const hass = makeHass({ devices: [env, c1] });

    expect(getContainerDevicesForEnvironment(hass, env).map((d) => d.id)).toEqual(['c1']);
  });
});

describe('getStackDevicesForEnvironment', () => {
  it('does not merge two config entries whose environments share the same numeric env_id', () => {
    const env1 = makeDevice({ id: 'env1', identifiers: [['dockhand', 'entryA_env_1']], config_entries: ['entryA'] });
    const env2 = makeDevice({ id: 'env2', identifiers: [['dockhand', 'entryB_env_1']], config_entries: ['entryB'] });
    const s1 = makeDevice({ id: 's1', identifiers: [['dockhand', 'entryA_stack_1_myapp']], config_entries: ['entryA'] });
    const s2 = makeDevice({ id: 's2', identifiers: [['dockhand', 'entryB_stack_1_myapp']], config_entries: ['entryB'] });
    const hass = makeHass({ devices: [env1, env2, s1, s2] });

    expect(getStackDevicesForEnvironment(hass, env1).map((d) => d.id)).toEqual(['s1']);
    expect(getStackDevicesForEnvironment(hass, env2).map((d) => d.id)).toEqual(['s2']);
  });
});

describe('getEnvDeviceForEnvId / getEnvDeviceIdForEnvId', () => {
  it('resolves the env device that shares a config entry with the reference device, not just any same-numbered one', () => {
    const env1 = makeDevice({ id: 'env1', identifiers: [['dockhand', 'entryA_env_1']], config_entries: ['entryA'] });
    const env2 = makeDevice({ id: 'env2', identifiers: [['dockhand', 'entryB_env_1']], config_entries: ['entryB'] });
    const c1 = makeDevice({ id: 'c1', identifiers: [['dockhand', 'entryA_container_1_web']], config_entries: ['entryA'] });
    const c2 = makeDevice({ id: 'c2', identifiers: [['dockhand', 'entryB_container_1_web']], config_entries: ['entryB'] });
    const hass = makeHass({ devices: [env1, env2, c1, c2] });

    const envIdFromC1 = getEnvIdForContainerDevice(c1);
    const envIdFromC2 = getEnvIdForContainerDevice(c2);
    expect(envIdFromC1).toBe(1);
    expect(envIdFromC2).toBe(1);

    expect(getEnvDeviceForEnvId(hass, envIdFromC1!, c1)?.id).toBe('env1');
    expect(getEnvDeviceForEnvId(hass, envIdFromC2!, c2)?.id).toBe('env2');
    expect(getEnvDeviceIdForEnvId(hass, envIdFromC1!, c1)).toBe('env1');
    expect(getEnvDeviceIdForEnvId(hass, envIdFromC2!, c2)).toBe('env2');
  });

  it('mirrors for stack devices', () => {
    const env1 = makeDevice({ id: 'env1', identifiers: [['dockhand', 'entryA_env_1']], config_entries: ['entryA'] });
    const env2 = makeDevice({ id: 'env2', identifiers: [['dockhand', 'entryB_env_1']], config_entries: ['entryB'] });
    const s1 = makeDevice({ id: 's1', identifiers: [['dockhand', 'entryA_stack_1_myapp']], config_entries: ['entryA'] });
    const s2 = makeDevice({ id: 's2', identifiers: [['dockhand', 'entryB_stack_1_myapp']], config_entries: ['entryB'] });
    const hass = makeHass({ devices: [env1, env2, s1, s2] });

    const envIdFromS1 = getEnvIdForStackDevice(s1);
    expect(getEnvDeviceForEnvId(hass, envIdFromS1!, s1)?.id).toBe('env1');
    expect(getEnvDeviceForEnvId(hass, envIdFromS1!, s2)?.id).toBe('env2');
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

  it('getScheduleHubDevices finds every hub, one per config entry', () => {
    const hubA = makeDevice({ id: 'hubA', identifiers: [['dockhand', 'entryA_schedules_hub']], config_entries: ['entryA'] });
    const hubB = makeDevice({ id: 'hubB', identifiers: [['dockhand', 'entryB_schedules_hub']], config_entries: ['entryB'] });
    const hass = makeHass({ devices: [hubA, hubB] });
    expect(getScheduleHubDevices(hass).map((d) => d.id).sort()).toEqual(['hubA', 'hubB']);
    expect(getScheduleHubDevices(makeHass({ devices: [] }))).toEqual([]);
  });

  it('getScheduleGroupDeviceForEnvironment finds env_<id>_Schedules for the matching config entry', () => {
    const env5 = makeDevice({ id: 'env5', identifiers: [['dockhand', 'entryA_env_5']], config_entries: ['entryA'] });
    const env9 = makeDevice({ id: 'env9', identifiers: [['dockhand', 'entryA_env_9']], config_entries: ['entryA'] });
    const group = makeDevice({ id: 'g1', identifiers: [['dockhand', 'entryA_env_5_Schedules']], config_entries: ['entryA'] });
    const hass = makeHass({ devices: [env5, env9, group] });
    expect(getScheduleGroupDeviceForEnvironment(hass, env5)?.id).toBe('g1');
    expect(getScheduleGroupDeviceForEnvironment(hass, env9)).toBeNull();
  });

  it('getScheduleGroupDeviceForEnvironment does not cross into another config entry\'s same-numbered group', () => {
    const envA = makeDevice({ id: 'envA', identifiers: [['dockhand', 'entryA_env_1']], config_entries: ['entryA'] });
    const envB = makeDevice({ id: 'envB', identifiers: [['dockhand', 'entryB_env_1']], config_entries: ['entryB'] });
    const groupA = makeDevice({ id: 'groupA', identifiers: [['dockhand', 'entryA_env_1_Schedules']], config_entries: ['entryA'] });
    const groupB = makeDevice({ id: 'groupB', identifiers: [['dockhand', 'entryB_env_1_Schedules']], config_entries: ['entryB'] });
    const hass = makeHass({ devices: [envA, envB, groupA, groupB] });

    expect(getScheduleGroupDeviceForEnvironment(hass, envA)?.id).toBe('groupA');
    expect(getScheduleGroupDeviceForEnvironment(hass, envB)?.id).toBe('groupB');
  });

  it('getScheduleDevicesForEnvironment resolves via via_device_id, not the schedule identifier', () => {
    const env5 = makeDevice({ id: 'env5', identifiers: [['dockhand', 'entryA_env_5']], config_entries: ['entryA'] });
    const env9 = makeDevice({ id: 'env9', identifiers: [['dockhand', 'entryA_env_9']], config_entries: ['entryA'] });
    const group5 = makeDevice({ id: 'group5', identifiers: [['dockhand', 'entryA_env_5_Schedules']], config_entries: ['entryA'] });
    const hub = makeDevice({ id: 'hub', identifiers: [['dockhand', 'schedules_hub']] });
    const s1 = makeDevice({ id: 's1', identifiers: [['dockhand', 'schedule_1_container_update']], via_device_id: 'group5' });
    const s2 = makeDevice({ id: 's2', identifiers: [['dockhand', 'schedule_2_system_cleanup']], via_device_id: 'hub' });
    const hass = makeHass({ devices: [env5, env9, group5, hub, s1, s2] });

    expect(getScheduleDevicesForEnvironment(hass, env5).map((d) => d.id)).toEqual(['s1']);
    expect(getScheduleDevicesForEnvironment(hass, env9)).toEqual([]);
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

  it('getGlobalScheduleDevices collects global schedules across every configured Dockhand instance, not just one', () => {
    // Two separate hubs (two config entries), each with their own genuinely
    // global schedule — both must show up, not just whichever hub happened
    // to be enumerated first (docs/BACKLOG.md's now-fixed "Schedules card"
    // entry).
    const hubA = makeDevice({ id: 'hubA', identifiers: [['dockhand', 'entryA_schedules_hub']], config_entries: ['entryA'] });
    const hubB = makeDevice({ id: 'hubB', identifiers: [['dockhand', 'entryB_schedules_hub']], config_entries: ['entryB'] });
    const s1 = makeDevice({ id: 's1', identifiers: [['dockhand', 'entryA_schedule_1_system_cleanup']], via_device_id: 'hubA' });
    const s2 = makeDevice({ id: 's2', identifiers: [['dockhand', 'entryB_schedule_1_system_cleanup']], via_device_id: 'hubB' });
    const hass = makeHass({ devices: [hubA, hubB, s1, s2] });

    expect(getGlobalScheduleDevices(hass).map((d) => d.id).sort()).toEqual(['s1', 's2']);
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

