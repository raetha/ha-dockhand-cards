import type { DeviceRegistryEntry, EntityRegistryEntry, HomeAssistant } from './ha-types';
import type { HassEntity } from 'home-assistant-js-websocket';

export function makeDevice(overrides: Partial<DeviceRegistryEntry> & { id: string }): DeviceRegistryEntry {
  return {
    name: null,
    name_by_user: null,
    area_id: null,
    model: null,
    manufacturer: null,
    identifiers: [],
    config_entry_id: null,
    configuration_url: null,
    hw_version: null,
    via_device_id: null,
    ...overrides
  };
}

/** An entry of `hass.entities`. Tests may pass `null` for a field Home
 * Assistant leaves out, as older fixtures do. */
type EntityOverrides = Omit<Partial<EntityRegistryEntry>, 'device_id' | 'translation_key' | 'entity_category'> & {
  entity_id: string;
  device_id?: string | null;
  translation_key?: string | null;
  entity_category?: EntityRegistryEntry['entity_category'] | null;
};

export function makeEntity(overrides: EntityOverrides): EntityRegistryEntry {
  const { device_id, translation_key, entity_category, ...rest } = overrides;
  return {
    platform: 'dockhand',
    labels: [],
    ...rest,
    ...(device_id ? { device_id } : {}),
    ...(translation_key ? { translation_key } : {}),
    ...(entity_category ? { entity_category } : {})
  };
}

export function makeState(overrides: Partial<HassEntity> & { entity_id: string; state: string }): HassEntity {
  return {
    attributes: {},
    context: { id: '1', parent_id: null, user_id: null },
    last_changed: '2026-01-01T00:00:00Z',
    last_updated: '2026-01-01T00:00:00Z',
    ...overrides
  } as HassEntity;
}

/** Minimal HomeAssistant mock — only the fields this repo's code touches. */
export function makeHass(opts: {
  devices?: DeviceRegistryEntry[];
  entities?: EntityRegistryEntry[];
  states?: HassEntity[];
  /** Real HA behavior this repo never reimplements (see common/card-
   * name.ts) — tests exercising resolveCardName supply their own mock
   * here rather than this fixture guessing at real HA formatting
   * behavior, which would risk testing this repo's assumptions about
   * formatEntityName instead of this repo's own logic. */
  formatEntityName?: HomeAssistant['formatEntityName'];
}): HomeAssistant {
  const devices: Record<string, DeviceRegistryEntry> = {};
  for (const d of opts.devices ?? []) devices[d.id] = d;

  const entities: Record<string, EntityRegistryEntry> = {};
  for (const e of opts.entities ?? []) entities[e.entity_id] = e;

  const states: Record<string, HassEntity> = {};
  for (const s of opts.states ?? []) states[s.entity_id] = s;

  return { devices, entities, states, formatEntityName: opts.formatEntityName } as unknown as HomeAssistant;
}
