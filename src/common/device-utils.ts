import { DOCKHAND_DOMAIN } from './const';
import type { DeviceRegistryEntry, HomeAssistant } from './ha-types';

// ha-dockhand's environment device identifier format:
//   Pre-1.9.0:  env_{env_id}                          (e.g. "env_1")
//   Post-1.9.0: {entry_id}_env_{env_id}               (e.g. "abc12345-..._env_1")
//
// The Containers/Stacks/Networks/etc. "group" devices for the same environment
// use identifiers like env_{env_id}_Containers — deliberately excluded here via
// the strict `env_<digits>` tail-anchor, since a name/model match alone can't
// tell them apart (group devices share model "Environment" too).
//
// The pattern accepts both formats for compatibility during the upgrade window
// when ha-dockhand and ha-dockhand-cards may not be updated simultaneously.
const ENV_DEVICE_ID_PATTERN = /^(?:.+_)?env_(\d+)$/;

export interface EnvironmentDeviceOption {
  deviceId: string;
  name: string;
}

export function getEnvironmentDevices(hass: HomeAssistant): EnvironmentDeviceOption[] {
  const devices = Object.values(hass.devices ?? {});
  const matches: EnvironmentDeviceOption[] = [];

  for (const device of devices) {
    if (isEnvironmentDevice(device)) {
      matches.push({
        deviceId: device.id,
        name: device.name_by_user || device.name || device.id
      });
    }
  }

  return matches.sort((a, b) => a.name.localeCompare(b.name));
}

export function isEnvironmentDevice(device: DeviceRegistryEntry): boolean {
  return (device.identifiers ?? []).some(
    ([domain, id]) => domain === DOCKHAND_DOMAIN && ENV_DEVICE_ID_PATTERN.test(id)
  );
}

/** Extracts the numeric env_id from an environment device's identifier.
 * Handles both pre-1.9.0 format (env_N) and post-1.9.0 format ({entry_id}_env_N). */
export function getEnvId(device: DeviceRegistryEntry): number | null {
  for (const [domain, id] of device.identifiers ?? []) {
    if (domain !== DOCKHAND_DOMAIN) continue;
    const match = ENV_DEVICE_ID_PATTERN.exec(id);
    if (match) return Number(match[1]);
  }
  return null;
}

// ha-dockhand container device identifier format:
//   Pre-1.9.0:  container_{env_id}_{name}             (e.g. "container_1_nginx")
//   Post-1.9.0: {entry_id}_container_{env_id}_{name}  (e.g. "abc12345-..._container_1_nginx")
//
// All matching functions below accept both formats.
export function getContainerDevicesForEnvironment(hass: HomeAssistant, envId: number): DeviceRegistryEntry[] {
  // Old format starts with container_{envId}_, new format has it as an infix.
  const directPrefix = `container_${envId}_`;
  const scopedInfix = `_container_${envId}_`;
  return Object.values(hass.devices ?? {}).filter((device) =>
    (device.identifiers ?? []).some(
      ([domain, id]) =>
        domain === DOCKHAND_DOMAIN && (id.startsWith(directPrefix) || id.includes(scopedInfix))
    )
  );
}

// ha-dockhand stack device identifier format:
//   Pre-1.9.0:  stack_{env_id}_{name}                 (e.g. "stack_1_myapp")
//   Post-1.9.0: {entry_id}_stack_{env_id}_{name}      (e.g. "abc12345-..._stack_1_myapp")
//
// Its `model` field is already "Internal Stack" / "Git Stack" / "Untracked Stack",
// so callers can read stack type straight off the device with no extra entity lookup.
export function isContainerDevice(device: DeviceRegistryEntry): boolean {
  return (device.identifiers ?? []).some(
    ([domain, id]) => domain === DOCKHAND_DOMAIN && /(?:^|.+_)container_\d+_/.test(id)
  );
}

export function isStackDevice(device: DeviceRegistryEntry): boolean {
  return (device.identifiers ?? []).some(
    ([domain, id]) => domain === DOCKHAND_DOMAIN && /(?:^|.+_)stack_\d+_/.test(id)
  );
}

export function getAllStackDevices(hass: HomeAssistant): DeviceRegistryEntry[] {
  return Object.values(hass.devices ?? {}).filter(isStackDevice);
}

export function getAllContainerDevices(hass: HomeAssistant): DeviceRegistryEntry[] {
  return Object.values(hass.devices ?? {}).filter(isContainerDevice);
}

export function getStackDevicesForEnvironment(hass: HomeAssistant, envId: number): DeviceRegistryEntry[] {
  const directPrefix = `stack_${envId}_`;
  const scopedInfix = `_stack_${envId}_`;
  return Object.values(hass.devices ?? {}).filter((device) =>
    (device.identifiers ?? []).some(
      ([domain, id]) =>
        domain === DOCKHAND_DOMAIN && (id.startsWith(directPrefix) || id.includes(scopedInfix))
    )
  );
}

/** Reverse of getContainerDevicesForEnvironment — which env does this container device belong to. */
export function getEnvIdForContainerDevice(device: DeviceRegistryEntry): number | null {
  for (const [domain, id] of device.identifiers ?? []) {
    if (domain !== DOCKHAND_DOMAIN) continue;
    // Matches both container_{env_id}_ and {entry_id}_container_{env_id}_
    const match = /(?:^|.+_)container_(\d+)_/.exec(id);
    if (match) return Number(match[1]);
  }
  return null;
}

/** Reverse of getStackDevicesForEnvironment — which env does this stack device belong to. */
export function getEnvIdForStackDevice(device: DeviceRegistryEntry): number | null {
  for (const [domain, id] of device.identifiers ?? []) {
    if (domain !== DOCKHAND_DOMAIN) continue;
    // Matches both stack_{env_id}_ and {entry_id}_stack_{env_id}_
    const match = /(?:^|.+_)stack_(\d+)_/.exec(id);
    if (match) return Number(match[1]);
  }
  return null;
}

/** device_id -> env device_id, for looking up an environment's own device
 * from any child (container/stack) device's env_id. */
export function getEnvDeviceIdForEnvId(hass: HomeAssistant, envId: number): string | null {
  for (const device of Object.values(hass.devices ?? {})) {
    if (isEnvironmentDevice(device) && getEnvId(device) === envId) return device.id;
  }
  return null;
}

// ha-dockhand schedule device identifier format:
//   Pre-1.9.0:  schedule_{id}_{type}                  (e.g. "schedule_1_system_cleanup")
//   Post-1.9.0: {entry_id}_schedule_{id}_{type}
//
// No env_id embedded, unlike containers/stacks, since a schedule can be
// genuinely global (environmentId: null in Dockhand's own /api/schedules —
// system cleanup jobs, destination-scoped repo maintenance). Which
// environment (if any) a schedule belongs to is expressed entirely through
// via_device instead: env-scoped schedules parent to that environment's own
// "env_{env_id}_Schedules" group device, global ones parent to the
// "schedules_hub" — see ha-dockhand's helpers.py _sched_device()/
// _schedule_group_device() docstrings.
export function isScheduleDevice(device: DeviceRegistryEntry): boolean {
  return (device.identifiers ?? []).some(
    ([domain, id]) =>
      domain === DOCKHAND_DOMAIN &&
      (id.startsWith('schedule_') || id.includes('_schedule_'))
  );
}

export function getAllScheduleDevices(hass: HomeAssistant): DeviceRegistryEntry[] {
  return Object.values(hass.devices ?? {}).filter(isScheduleDevice);
}

/** Find a device by an exact identifier value, accepting both pre-1.9.0 bare
 * identifiers and post-1.9.0 entry_id-prefixed ones. */
function findDeviceByIdentifier(hass: HomeAssistant, bareIdentifier: string): DeviceRegistryEntry | null {
  return (
    Object.values(hass.devices ?? {}).find((d) =>
      (d.identifiers ?? []).some(
        ([domain, id]) =>
          domain === DOCKHAND_DOMAIN &&
          // Exact match (old format) or prefixed match (new format: {uuid}_{bareIdentifier})
          (id === bareIdentifier || id.endsWith(`_${bareIdentifier}`))
      )
    ) ?? null
  );
}

/** The hub every genuinely global schedule (environmentId: null) parents
 * to — only present at all when "Enable schedules" is on and at least one
 * global schedule exists (see ha-dockhand's _ensure_hub_devices). */
export function getScheduleHubDevice(hass: HomeAssistant): DeviceRegistryEntry | null {
  return findDeviceByIdentifier(hass, 'schedules_hub');
}

/** An environment's own Schedules group device — only present when that
 * environment has at least one env-scoped schedule. */
export function getScheduleGroupDeviceForEnvironment(hass: HomeAssistant, envId: number): DeviceRegistryEntry | null {
  return findDeviceByIdentifier(hass, `env_${envId}_Schedules`);
}

/** Every schedule device belonging to one environment, resolved via
 * via_device_id against that environment's own Schedules group — not by
 * parsing the schedule device's own identifier, which carries no env_id. */
export function getScheduleDevicesForEnvironment(hass: HomeAssistant, envId: number): DeviceRegistryEntry[] {
  const group = getScheduleGroupDeviceForEnvironment(hass, envId);
  if (!group) return [];
  return getAllScheduleDevices(hass).filter((d) => d.via_device_id === group.id);
}

/** Every genuinely global schedule device (environmentId: null on
 * Dockhand's own data) — parented to schedules_hub rather than any
 * environment's group. */
export function getGlobalScheduleDevices(hass: HomeAssistant): DeviceRegistryEntry[] {
  const hub = getScheduleHubDevice(hass);
  if (!hub) return [];
  return getAllScheduleDevices(hass).filter((d) => d.via_device_id === hub.id);
}

// Matches both env_{env_id}_Schedules (old) and {entry_id}_env_{env_id}_Schedules (new)
const ENV_SCHEDULES_GROUP_PATTERN = /^(?:.+_)?env_(\d+)_Schedules$/;

/** Reverse of getScheduleDevicesForEnvironment — which env does this
 * schedule device belong to, or null if it's genuinely global (parented
 * to schedules_hub, not any environment's group). Needs `hass` to resolve
 * via_device_id, unlike getEnvIdForContainerDevice/getEnvIdForStackDevice
 * — a schedule device's own identifier carries no env_id. */
export function getEnvIdForScheduleDevice(hass: HomeAssistant, device: DeviceRegistryEntry): number | null {
  if (!device.via_device_id) return null;
  const parent = hass.devices?.[device.via_device_id];
  if (!parent) return null;
  for (const [domain, id] of parent.identifiers ?? []) {
    if (domain !== DOCKHAND_DOMAIN) continue;
    const match = ENV_SCHEDULES_GROUP_PATTERN.exec(id);
    if (match) return Number(match[1]);
  }
  return null;
}

/** Any one entity registered to this device, for the Name field's
 * entity_name selector to resolve Composed-mode Area/Device/Floor values
 * against. Picks the lowest entity_id for determinism (stable across polls,
 * not "whichever happened to register first"). Returns undefined if the
 * device has no entities yet. */
export function getRepresentativeEntityId(hass: HomeAssistant, deviceId: string): string | undefined {
  const candidates = Object.values(hass.entities ?? {})
    .filter((e) => e.device_id === deviceId)
    .map((e) => e.entity_id)
    .sort();
  return candidates[0];
}
