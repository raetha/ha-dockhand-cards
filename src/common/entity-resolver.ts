import {
  DOCKHAND_DOMAIN,
  ENV_TRANSLATION_KEYS,
  CONTAINER_TRANSLATION_KEYS,
  STACK_TRANSLATION_KEYS,
  SCHEDULE_TRANSLATION_KEYS,
  type EnvTranslationKey,
  type ContainerTranslationKey,
  type StackTranslationKey,
  type ScheduleTranslationKey
} from './const';
import { getContainerName, getStackName } from './device-utils';
import type { HomeAssistant, EntityRegistryEntry, DeviceRegistryEntry } from './ha-types';
import type { HassEntity } from 'home-assistant-js-websocket';

export interface ResolvedEntity<K extends string = string> {
  key: K;
  entityId: string;
  state: HassEntity;
}

export interface UnavailableEntity<K extends string = string> {
  key: K;
  entityId: string | null;
  reason: 'disabled' | 'not_found';
}

export interface ResolutionResult<K extends string = string> {
  found: Partial<Record<K, ResolvedEntity<K>>>;
  unavailable: UnavailableEntity<K>[];
}

function entitiesForDevice(hass: HomeAssistant, deviceId: string): EntityRegistryEntry[] {
  return Object.values(hass.entities ?? {}).filter(
    (e) => e.device_id === deviceId && e.platform === DOCKHAND_DOMAIN
  );
}

/**
 * Resolves the ha-dockhand entities on one device by translation_key —
 * never by parsing unique_id, since ha-dockhand's own architecture.md
 * documents that format as an internal detail that can change between
 * releases. translation_key is the stable, intentional contract.
 *
 * A disabled entity still has an entity registry entry (with no matching
 * hass.states entry), so it's reported distinctly from a translation_key
 * that doesn't exist at all (e.g. an older ha-dockhand release that
 * predates that entity, or — for git-only keys on a non-git stack — one
 * that Dockhand simply never creates for this particular device).
 */
export function resolveEntities<K extends string>(
  hass: HomeAssistant,
  deviceId: string,
  keyMap: Record<K, string>,
  keys: K[]
): ResolutionResult<K> {
  const byTranslationKey = new Map(entitiesForDevice(hass, deviceId).map((e) => [e.translation_key, e]));

  const found: ResolutionResult<K>['found'] = {};
  const unavailable: UnavailableEntity<K>[] = [];

  for (const key of keys) {
    const translationKey = keyMap[key];
    const registryEntry = byTranslationKey.get(translationKey);

    if (!registryEntry) {
      unavailable.push({ key, entityId: null, reason: 'not_found' });
      continue;
    }

    if (registryEntry.disabled_by) {
      unavailable.push({ key, entityId: registryEntry.entity_id, reason: 'disabled' });
      continue;
    }

    const state = hass.states[registryEntry.entity_id];
    if (!state) {
      // Registered and enabled, but no state yet (e.g. right after HA
      // restart before the coordinator's first refresh) — treat as
      // temporarily unavailable rather than misreporting as disabled.
      unavailable.push({ key, entityId: registryEntry.entity_id, reason: 'not_found' });
      continue;
    }

    found[key] = { key, entityId: registryEntry.entity_id, state };
  }

  return { found, unavailable };
}

export function resolveEnvironmentEntities(
  hass: HomeAssistant,
  deviceId: string,
  keys: EnvTranslationKey[]
): ResolutionResult<EnvTranslationKey> {
  return resolveEntities(hass, deviceId, ENV_TRANSLATION_KEYS, keys);
}

export function resolveContainerEntities(
  hass: HomeAssistant,
  deviceId: string,
  keys: ContainerTranslationKey[]
): ResolutionResult<ContainerTranslationKey> {
  return resolveEntities(hass, deviceId, CONTAINER_TRANSLATION_KEYS, keys);
}

export function resolveStackEntities(
  hass: HomeAssistant,
  deviceId: string,
  keys: StackTranslationKey[]
): ResolutionResult<StackTranslationKey> {
  return resolveEntities(hass, deviceId, STACK_TRANSLATION_KEYS, keys);
}

export function resolveScheduleEntities(
  hass: HomeAssistant,
  deviceId: string,
  keys: ScheduleTranslationKey[]
): ResolutionResult<ScheduleTranslationKey> {
  return resolveEntities(hass, deviceId, SCHEDULE_TRANSLATION_KEYS, keys);
}

export interface TopContainerEntry {
  name: string;
  cpuPercent: number | null;
  memoryPercent: number | null;
}

/**
 * Resolves a device's single "primary" entity of a given domain — for the
 * small set of ha-dockhand entities that deliberately have no
 * translation_key (has_entity_name=True with the entity name equal to the
 * device name: the container/stack running switch, the container `update`
 * entity). The device can also carry other
 * entities of the same domain that do have a translation_key (a container's
 * `container_auto_update` switch, once enabled), so the lookup requires the
 * missing translation_key as well as the domain — otherwise whichever
 * switch the registry happened to list first would win.
 */
export function findPrimaryEntityByDomain(
  hass: HomeAssistant,
  deviceId: string,
  domain: string
): { entityId: string; state: HassEntity } | null {
  const entry = Object.values(hass.entities ?? {}).find(
    (e) => e.device_id === deviceId && e.platform === DOCKHAND_DOMAIN && e.entity_id.startsWith(`${domain}.`) && !e.translation_key && !e.disabled_by
  );
  if (!entry) return null;
  const state = hass.states[entry.entity_id];
  if (!state) return null;
  return { entityId: entry.entity_id, state };
}

export interface DeviceDropdownOption {
  value: string;
  label: string;
}

/** Editor dropdown options for a list of container/stack devices, using
 * the raw Docker/stack name from the device identifier (e.g. "traefik1")
 * rather than the full device display name (e.g. "Forseti – Containers –
 * traefik1"), sorted alphabetically by that label. */
export function getContainerDropdownOptions(devices: DeviceRegistryEntry[]): DeviceDropdownOption[] {
  const options = devices.map((d) => {
    return { value: d.id, label: getContainerName(d) || d.name_by_user || d.name || d.id };
  });
  return options.sort((a, b) => a.label.localeCompare(b.label));
}

export function getStackDropdownOptions(devices: DeviceRegistryEntry[]): DeviceDropdownOption[] {
  const options = devices.map((d) => {
    return { value: d.id, label: getStackName(d) || d.name_by_user || d.name || d.id };
  });
  return options.sort((a, b) => a.label.localeCompare(b.label));
}
