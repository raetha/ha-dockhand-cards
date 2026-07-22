import { DOCKHAND_DOMAIN } from './const';
import type { DeviceRegistryEntry, HomeAssistant } from './ha-types';

// ha-dockhand's environment device uses identifiers = {(DOMAIN, f"env_{env_id}")}
// with no further suffix. The Containers/Stacks/Networks/etc. "group"
// devices for the same environment use identifiers like
// f"env_{env_id}_Containers" — deliberately excluded here via the strict
// `env_<digits>` match, since a name/model match alone can't tell them
// apart (group devices share model "Environment" too).
const ENV_DEVICE_ID_PATTERN = /^env_\d+$/;

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

/** Extracts the numeric env_id from an environment device's identifier. */
export function getEnvId(device: DeviceRegistryEntry): number | null {
  for (const [domain, id] of device.identifiers ?? []) {
    if (domain !== DOCKHAND_DOMAIN) continue;
    const match = ENV_DEVICE_ID_PATTERN.exec(id);
    if (match) return Number(id.slice('env_'.length));
  }
  return null;
}

// ha-dockhand container devices use identifiers = {(DOMAIN, f"container_{env_id}_{name}")}
// — see helpers.py's _container_device docstring.
export function getContainerDevicesForEnvironment(hass: HomeAssistant, envId: number): DeviceRegistryEntry[] {
  const prefix = `container_${envId}_`;
  return Object.values(hass.devices ?? {}).filter((device) =>
    (device.identifiers ?? []).some(([domain, id]) => domain === DOCKHAND_DOMAIN && id.startsWith(prefix))
  );
}

// ha-dockhand stack devices use identifiers = {(DOMAIN, f"stack_{env_id}_{name}")} —
// see helpers.py's _stack_device docstring. Its `model` field is already
// "Internal Stack" / "Git Stack" / "Untracked Stack", so callers can read
// stack type straight off the device with no extra entity lookup.
export function isContainerDevice(device: DeviceRegistryEntry): boolean {
  return (device.identifiers ?? []).some(([domain, id]) => domain === DOCKHAND_DOMAIN && /^container_\d+_/.test(id));
}

export function isStackDevice(device: DeviceRegistryEntry): boolean {
  return (device.identifiers ?? []).some(([domain, id]) => domain === DOCKHAND_DOMAIN && /^stack_\d+_/.test(id));
}

export function getAllStackDevices(hass: HomeAssistant): DeviceRegistryEntry[] {
  return Object.values(hass.devices ?? {}).filter((device) =>
    (device.identifiers ?? []).some(([domain, id]) => domain === DOCKHAND_DOMAIN && /^stack_\d+_/.test(id))
  );
}

export function getAllContainerDevices(hass: HomeAssistant): DeviceRegistryEntry[] {
  return Object.values(hass.devices ?? {}).filter((device) =>
    (device.identifiers ?? []).some(([domain, id]) => domain === DOCKHAND_DOMAIN && /^container_\d+_/.test(id))
  );
}

export function getStackDevicesForEnvironment(hass: HomeAssistant, envId: number): DeviceRegistryEntry[] {
  const prefix = `stack_${envId}_`;
  return Object.values(hass.devices ?? {}).filter((device) =>
    (device.identifiers ?? []).some(([domain, id]) => domain === DOCKHAND_DOMAIN && id.startsWith(prefix))
  );
}

/** Reverse of getContainerDevicesForEnvironment — which env does this container device belong to. */
export function getEnvIdForContainerDevice(device: DeviceRegistryEntry): number | null {
  for (const [domain, id] of device.identifiers ?? []) {
    if (domain !== DOCKHAND_DOMAIN) continue;
    const match = /^container_(\d+)_/.exec(id);
    if (match) return Number(match[1]);
  }
  return null;
}

/** Reverse of getStackDevicesForEnvironment — which env does this stack device belong to. */
export function getEnvIdForStackDevice(device: DeviceRegistryEntry): number | null {
  for (const [domain, id] of device.identifiers ?? []) {
    if (domain !== DOCKHAND_DOMAIN) continue;
    const match = /^stack_(\d+)_/.exec(id);
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
