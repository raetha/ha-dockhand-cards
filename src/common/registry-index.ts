import type { HomeAssistant, EntityRegistryEntry } from './ha-types';

// Home Assistant sends a new `hass` whenever any state changes, and the
// cards look up each device's entities on every render: a scan of every
// entity in Home Assistant per device made a card's render grow with
// devices × entities. Home Assistant replaces `hass.entities` with a new
// object when the registry changes, so an index built per object stays
// current and is built once per registry change.
const byDevice = new WeakMap<object, Map<string, EntityRegistryEntry[]>>();

/** The entities on one device, from `hass.entities` (enabled entities only). */
export function entitiesOnDevice(hass: HomeAssistant, deviceId: string): EntityRegistryEntry[] {
  const registry = hass.entities;
  if (!registry) return [];
  let index = byDevice.get(registry);
  if (!index) {
    index = new Map();
    for (const entry of Object.values(registry)) {
      if (!entry.device_id) continue;
      const list = index.get(entry.device_id);
      if (list) list.push(entry);
      else index.set(entry.device_id, [entry]);
    }
    byDevice.set(registry, index);
  }
  return index.get(deviceId) ?? [];
}
