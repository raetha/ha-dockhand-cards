import { DOCKHAND_DOMAIN } from './const';
import type { HomeAssistant } from './ha-types';

/** A disabled ha-dockhand entity, from the full entity registry. */
export interface DisabledEntity {
  entity_id: string;
  translation_key: string;
}

interface RegistryListEntry {
  entity_id: string;
  device_id: string | null;
  platform: string;
  translation_key: string | null;
  disabled_by: string | null;
}

/** How long a loaded list is trusted before an editor loads it again. */
const MAX_AGE_MS = 30_000;

let byDevice = new Map<string, DisabledEntity[]>();
let loadedAt = 0;
let pending: Promise<boolean> | undefined;

/**
 * `hass.entities` lists only enabled entities (Home Assistant's
 * `config/entity_registry/list_for_display` skips disabled ones), so a card
 * can't tell a disabled sensor from one that doesn't exist. Editors load
 * the full registry (an admin-only call, as editing a dashboard is) to name
 * the disabled ones a card would use. Resolves to whether a new list
 * arrived; cards never call it.
 */
export function loadDisabledEntities(hass: HomeAssistant): Promise<boolean> {
  if (pending) return pending;
  if (loadedAt && Date.now() - loadedAt < MAX_AGE_MS) return Promise.resolve(false);
  pending = Promise.resolve()
    .then(() => hass.callWS<RegistryListEntry[]>({ type: 'config/entity_registry/list' }))
    .then((entries) => {
      const next = new Map<string, DisabledEntity[]>();
      for (const e of Array.isArray(entries) ? entries : []) {
        if (!e.disabled_by || e.platform !== DOCKHAND_DOMAIN || !e.device_id || !e.translation_key) continue;
        next.set(e.device_id, [...(next.get(e.device_id) ?? []), { entity_id: e.entity_id, translation_key: e.translation_key }]);
      }
      byDevice = next;
      loadedAt = Date.now();
      return true;
    })
    .catch(() => false)
    .finally(() => {
      pending = undefined;
    });
  return pending;
}

/** The device's disabled ha-dockhand entities, once an editor has loaded them. */
export function disabledEntitiesForDevice(deviceId: string): DisabledEntity[] {
  return byDevice.get(deviceId) ?? [];
}

/** For tests: forget what was loaded. */
export function resetDisabledEntities(): void {
  byDevice = new Map();
  loadedAt = 0;
  pending = undefined;
}
